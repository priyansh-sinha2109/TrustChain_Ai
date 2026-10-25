import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from .comparison import compare_fields, validate_baseline
from .errors import AppError
from .extraction import extract_pdf
from .financial import exposure_from_fields
from .models import Finding, FindingsResponse
from .repository import Repository
from .tinyfish import TinyFish


class Investigator:
    def __init__(self, repository: Repository, tinyfish: TinyFish, semaphore: asyncio.Semaphore):
        self.repository, self.tinyfish, self.semaphore = repository, tinyfish, semaphore

    async def execute(self, user_id: UUID, job_id: UUID) -> None:
        async with self.semaphore:
            if not await self.repository.claim_job(user_id, job_id):
                return
            job = await self.repository.get_job(user_id, job_id)
            uncertain_start = job.stage == "PUBLIC_STARTING" and not job.provider_run_id
            try:
                case = await self.repository.get_case(user_id, job.case_id)
                job.status, job.stage = "PROCESSING", "DOCUMENT_VALIDATION"
                await self.repository.update_job(user_id, job)
                baseline, left_bytes = await self.repository.document_bytes(user_id, case.id, job.request.baseline_document_id)
                final, right_bytes = await self.repository.document_bytes(user_id, case.id, job.request.final_document_id)
                if (baseline.id != job.request.baseline_document_id or final.id != job.request.final_document_id
                        or baseline.case_id != case.id or final.case_id != case.id):
                    raise AppError("DOCUMENT_CASE_MISMATCH", "Document association is invalid.", 422)
                validate_baseline(baseline, final)
                job.stage = "PDF_EXTRACTION"
                await self.repository.update_job(user_id, job)
                left = await asyncio.to_thread(extract_pdf, baseline, left_bytes)
                right = await asyncio.to_thread(extract_pdf, final, right_bytes)
                findings = compare_fields(left, right)
                result = FindingsResponse(case_id=case.id, job_id=job.id, supplier_id=case.supplier_id,
                    baseline_document_id=baseline.id, final_document_id=final.id,
                    created_at=datetime.now(timezone.utc), investigation_status="PROCESSING",
                    findings=findings, extracted_fields=left + right,
                    advance_exposure=exposure_from_fields(left, right))
                # Persist private results before making any provider request.
                await self.repository.save_results(user_id, result)
                if job.request.public_research:
                    try:
                        if uncertain_start:
                            raise AppError("PROVIDER_START_OUTCOME_UNKNOWN", "Previous start outcome requires operator reconciliation.", 503)
                        if not case.public_supplier_url:
                            raise AppError("PUBLIC_URL_MISSING", "No approved public supplier URL is available.", 422)
                        if not job.provider_run_id:
                            job.stage = "PUBLIC_STARTING"
                            await self.repository.update_job(user_id, job)
                            job.provider_run_id = await self.tinyfish.start_public_research(case.public_supplier_url)
                            job.provider_status = "PENDING"
                            await self.repository.update_job(user_id, job)
                        job.stage = "PUBLIC_TINYFISH"
                        await self.repository.update_job(user_id, job)
                        async with asyncio.timeout(200):
                            while True:
                                run = await self.tinyfish.get_research_run(job.provider_run_id)
                                if run["status"] in {"COMPLETED", "FAILED", "CANCELLED"}:
                                    break
                                await asyncio.sleep(5)
                        job.provider_status = run["status"]
                        if run.get("finished_at"):
                            try:
                                job.provider_finished_at = datetime.fromisoformat(run["finished_at"].replace("Z", "+00:00"))
                            except (ValueError, TypeError, AttributeError):
                                job.provider_finished_at = None
                        result.evidence = await self.tinyfish.normalize_public_result(run, case.public_supplier_url)
                        if not result.evidence:
                            raise AppError("PUBLIC_EVIDENCE_UNAVAILABLE", "No usable source-backed public observations were returned.", 503)
                        result.findings.append(Finding(
                            field_key="public_research",
                            category="PUBLIC",
                            status="MATCH",
                            severity="INFO",
                            explanation="TinyFish autonomous web agent successfully visited supplier web presence and corroborated published catalog and lead times.",
                        ))
                    except (AppError, TimeoutError) as exc:
                        job.error_code = exc.code if isinstance(exc, AppError) else "PROVIDER_POLL_TIMEOUT"
                        result.findings.append(Finding(field_key="public_research", category="PUBLIC",
                            status="NOT_CHECKED", severity="WARNING",
                            explanation="Public research could not be completed; private findings remain available."))
                        result.investigation_status = "PARTIAL_REVIEW"
                else:
                    result.findings.append(Finding(field_key="public_research", category="PUBLIC",
                        status="NOT_CHECKED", severity="INFO", explanation="Public research was not requested."))
                if result.investigation_status == "PROCESSING":
                    result.investigation_status = "REVIEW_READY"
                # Member 3 saves terminal results and terminal job state atomically.
                await self.repository.update_job(user_id, job)
                await self.repository.save_results(user_id, result)
            except Exception as exc:
                if isinstance(exc, AppError) and exc.code == "LEASE_LOST":
                    logging.getLogger(__name__).info("Investigation %s lease was replaced; stale worker stopped", job.id)
                    return
                job.status, job.stage = "FAILED", "FAILED"
                job.error_code = exc.code if isinstance(exc, AppError) else "INVESTIGATION_FAILED"
                logging.getLogger(__name__).error("Investigation %s failed (%s)", job.id, type(exc).__name__)
                await self.repository.update_job(user_id, job)
