"""Async compatibility adapter around Member 3's synchronous Supabase data layer.

Each call owns a PostgreSQL transaction and a verified TenantSecurityContext. Storage
requests run in the same bounded worker executor, never on FastAPI's event loop.
"""
import asyncio
import hashlib
from concurrent.futures import ThreadPoolExecutor
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from trustchain.database.client import SupabaseClientConfig
from trustchain.database.models import DocTypeEnum, RoleEnum
from trustchain.database.repository import SupabaseRepository
from trustchain.database.security import TenantAuthorizer, TenantSecurityContext
from trustchain.database.storage import StorageService, StorageError
from trustchain.database.transaction_client import TransactionClient

from .config import Settings
from .errors import AppError
from .database_mapping import REVIEW_TO_DATABASE, research_status
from .models import (Case, CaseCreate, Document, FindingsResponse, InvestigationStart,
                     Job, Review, UploadIntent, UploadTarget)


def require(condition, code="NOT_FOUND", message="Resource not found.", status=404):
    if not condition:
        raise AppError(code, message, status)


def request_fingerprint(data: InvestigationStart) -> str:
    import json
    return hashlib.sha256(json.dumps(data.model_dump(mode="json"), sort_keys=True,
        separators=(",", ":")).encode()).hexdigest()


def resolve_context(connection, user_id: UUID) -> TenantSecurityContext:
    rows = connection.execute("SELECT org_id, role FROM public.organization_members WHERE user_id=%s AND is_active FOR SHARE",
        (user_id,)).fetchall()
    require(len(rows) == 1, "MEMBERSHIP_REQUIRED" if not rows else "AMBIGUOUS_MEMBERSHIP",
        "Exactly one active organisation membership is required.", 403)
    try:
        return TenantSecurityContext(user_id=user_id, org_id=UUID(str(rows[0]["org_id"])),
            role=RoleEnum(rows[0]["role"]))
    except ValueError:
        raise AppError("INVALID_MEMBERSHIP", "Organisation role is not authorized.", 403) from None


class SupabaseAdapter:
    def __init__(self, settings: Settings, *, connect=psycopg.connect, storage=None):
        self.settings, self.connect = settings, connect
        self.storage = storage or StorageService(supabase_url=settings.supabase_url,
            service_role_key=settings.supabase_service_role_key.get_secret_value())
        self.config = SupabaseClientConfig(supabase_url=settings.supabase_url,
            supabase_key=settings.supabase_anon_key.get_secret_value(),
            service_role_key=settings.supabase_service_role_key.get_secret_value())
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="trustchain-db")
        self.slots = asyncio.Semaphore(4)
        # Per-execution fencing capability, not a cache of job state. Jobs/leases live in SQL.
        self.lease = ContextVar("investigation_lease", default=None)

    async def close(self):
        await asyncio.to_thread(self.executor.shutdown, wait=True)

    async def _call(self, user_id, operation, *args):
        async with self.slots:
            future = asyncio.get_running_loop().run_in_executor(self.executor,
                self._transaction, user_id, operation, args)
            try:
                return await asyncio.shield(future)
            except asyncio.CancelledError:
                # Retain the slot until the running synchronous transaction is finished.
                await asyncio.shield(future)
                raise

    def _transaction(self, user_id, operation, args):
        try:
            with self.connect(self.settings.database_url.get_secret_value(), row_factory=dict_row,
                    connect_timeout=10, options="-c statement_timeout=15000 -c lock_timeout=5000") as connection:
                context = resolve_context(connection, user_id)
                repo = SupabaseRepository(TransactionClient(connection, self.config))
                return operation(connection, repo, context, *args)
        except PermissionError:
            raise AppError("FORBIDDEN", "This action is not permitted for this tenant or role.", 403) from None
        except StorageError as exc:
            raise AppError(exc.code, exc.message, exc.status) from None
        except psycopg.Error:
            raise AppError("DATABASE_UNAVAILABLE", "Database operation could not be completed.", 503) from None

    @staticmethod
    def _case(connection, repo, context, case_id):
        case = repo.get_purchase_case(context, case_id)
        require(case is not None)
        rows = connection.execute("""SELECT s.* FROM public.case_suppliers cs
            JOIN public.suppliers s ON s.id=cs.supplier_id
            WHERE cs.case_id=%s AND cs.is_primary AND s.org_id=%s""", (case_id, context.org_id)).fetchall()
        require(len(rows) == 1, "SUPPLIER_ASSOCIATION_INVALID", "Case must have one primary supplier.", 409)
        supplier = rows[0]
        return Case(id=case.id, supplier_id=supplier["id"], title=case.title,
            supplier_name=supplier["legal_name"], public_supplier_url=supplier.get("website_url"))

    async def create_case(self, user_id: UUID, data: CaseCreate) -> Case:
        def create(connection, repo, context):
            case_id = uuid4()
            case = repo.create_purchase_case(context, title=data.title,
                case_number=f"TC-{case_id}", case_id=case_id)
            supplier = repo.register_supplier(context, legal_name=data.supplier_name,
                website_url=data.public_supplier_url)
            repo.attach_supplier_to_case(context, case.id, supplier.id)
            return self._case(connection, repo, context, case.id)
        return await self._call(user_id, create)

    async def list_cases(self, user_id: UUID) -> list[Case]:
        def listing(connection, repo, context):
            rows = connection.execute("SELECT id FROM public.purchase_cases WHERE org_id=%s ORDER BY created_at DESC,id",
                (context.org_id,)).fetchall()
            return [self._case(connection, repo, context, row["id"]) for row in rows]
        return await self._call(user_id, listing)

    async def get_case(self, user_id: UUID, case_id: UUID) -> Case:
        return await self._call(user_id, self._case, case_id)

    @staticmethod
    def _document(connection, repo, context, case_id, document_id, *, lock=False):
        require(repo.get_purchase_case(context, case_id) is not None)
        row = connection.execute("SELECT * FROM public.documents WHERE id=%s AND case_id=%s" +
            (" FOR UPDATE" if lock else ""), (document_id, case_id)).fetchone()
        require(row is not None)
        require(row["storage_key"] == StorageService.generate_storage_key(context.org_id, case_id, document_id),
            "OBJECT_ASSOCIATION_INVALID", "Document does not reference its canonical private object.", 409)
        approved = connection.execute("SELECT 1 FROM public.document_approvals WHERE document_id=%s AND sha256=%s",
            (document_id, row["sha256"])).fetchone() is not None
        require(row["doc_type"] in {"RFQ", "ACCEPTED_QUOTE", "PURCHASE_ORDER", "FINAL_PI"},
            "UNSUPPORTED_DOCUMENT", "Document type is not supported by the investigation API.", 422)
        return Document(id=row["id"], case_id=row["case_id"], document_type=row["doc_type"],
            approved=approved, content_type=row["mime_type"], size_bytes=row["file_size"]), row

    async def list_documents(self, user_id: UUID, case_id: UUID) -> list[Document]:
        def listing(connection, repo, context):
            docs = repo.list_case_documents(context, case_id)
            return [self._document(connection, repo, context, case_id, doc.id)[0]
                for doc in docs if doc.doc_type != DocTypeEnum.OTHER]
        return await self._call(user_id, listing)

    async def upload_intent(self, user_id: UUID, case_id: UUID, data: UploadIntent) -> UploadTarget:
        def reserve(connection, repo, context):
            self._case(connection, repo, context, case_id)
            TenantAuthorizer.verify_role_permission(context, [RoleEnum.BUYER, RoleEnum.ADMIN])
            document_id = uuid4()
            ticket = self.storage.create_signed_upload_instruction(context.org_id, case_id,
                data.filename, data.size_bytes, doc_id=document_id)
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=ticket["expires_in_seconds"])
            connection.execute("""INSERT INTO public.document_uploads
                (id,org_id,case_id,user_id,doc_type,file_name,file_size,storage_key,expires_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (document_id, context.org_id,
                case_id, context.user_id, data.document_type.value, data.filename, data.size_bytes,
                ticket["storage_key"], expires_at))
            repo.append_audit_event(context, "DOCUMENT_UPLOAD_RESERVED", {"document_id": str(document_id), "case_id": str(case_id)})
            return UploadTarget(document_id=document_id, upload_url=ticket["upload_url"], expires_at=expires_at)
        return await self._call(user_id, reserve)

    async def confirm_upload(self, user_id: UUID, case_id: UUID, document_id: UUID) -> Document:
        def confirm(connection, repo, context):
            case = self._case(connection, repo, context, case_id)
            TenantAuthorizer.verify_role_permission(context, [RoleEnum.BUYER, RoleEnum.ADMIN])
            ticket = connection.execute("SELECT * FROM public.document_uploads WHERE id=%s AND case_id=%s AND org_id=%s FOR UPDATE",
                (document_id, case_id, context.org_id)).fetchone()
            require(ticket is not None)
            require(ticket["user_id"] == context.user_id or context.role == RoleEnum.ADMIN,
                "FORBIDDEN", "Upload belongs to another user.", 403)
            if ticket["confirmed_at"]:
                return self._document(connection, repo, context, case_id, document_id)[0]
            require(ticket["expires_at"] > datetime.now(timezone.utc), "UPLOAD_EXPIRED", "Upload reservation expired.", 409)
            content = self.storage.download_document(ticket["storage_key"], context.org_id, case_id)
            require(len(content) == ticket["file_size"], "INVALID_DOCUMENT_SIZE", "Uploaded object size differs from its reservation.", 422)
            digest = self.storage.compute_sha256(content)
            from .extraction import extract_pdf
            try:
                extract_pdf(Document(id=document_id, case_id=case_id, document_type=ticket["doc_type"],
                    size_bytes=len(content)), content)
            except AppError as exc:
                if exc.code != "OCR_REQUIRED":
                    raise
            repo.register_document(context, case_id=case_id, doc_type=DocTypeEnum(ticket["doc_type"]),
                storage_key=ticket["storage_key"], file_name=ticket["file_name"], file_size=len(content),
                supplier_id=case.supplier_id, sha256=digest, document_id=document_id)
            connection.execute("UPDATE public.document_uploads SET confirmed_at=clock_timestamp(),sha256=%s WHERE id=%s",
                (digest, document_id))
            return self._document(connection, repo, context, case_id, document_id)[0]
        return await self._call(user_id, confirm)

    async def document_bytes(self, user_id: UUID, case_id: UUID, document_id: UUID) -> tuple[Document, bytes]:
        def download(connection, repo, context):
            document, row = self._document(connection, repo, context, case_id, document_id)
            require(row["storage_key"] == self.storage.generate_storage_key(context.org_id, case_id, document_id),
                "OBJECT_ASSOCIATION_INVALID", "Document object association is invalid.", 409)
            content = self.storage.download_document(row["storage_key"], context.org_id, case_id)
            require(len(content) == document.size_bytes and self.storage.compute_sha256(content) == row["sha256"],
                "DOCUMENT_INTEGRITY_FAILED", "Document bytes do not match the registered object.", 409)
            return document, content
        return await self._call(user_id, download)

    async def approve_document(self, user_id: UUID, case_id: UUID, document_id: UUID, note: str) -> Document:
        def approve(connection, repo, context):
            TenantAuthorizer.verify_reviewer_authority(context)
            document, row = self._document(connection, repo, context, case_id, document_id, lock=True)
            require(document.document_type in {"ACCEPTED_QUOTE", "PURCHASE_ORDER"} and row["sha256"],
                "INVALID_BASELINE", "Only a confirmed quotation or purchase order can be approved.", 422)
            if document.approved:
                return document
            content = self.storage.download_document(row["storage_key"], context.org_id, case_id)
            require(len(content) == document.size_bytes and self.storage.compute_sha256(content) == row["sha256"],
                "DOCUMENT_INTEGRITY_FAILED", "Document bytes changed after registration.", 409)
            connection.execute("""INSERT INTO public.document_approvals
                (document_id,org_id,case_id,approved_by,sha256,note) VALUES (%s,%s,%s,%s,%s,%s)""",
                (document_id, context.org_id, case_id, user_id, row["sha256"], note))
            repo.append_audit_event(context, "BASELINE_DOCUMENT_APPROVED", {
                "document_id": str(document_id), "case_id": str(case_id), "sha256": row["sha256"], "note": note})
            return document.model_copy(update={"approved": True})
        return await self._call(user_id, approve)

    @staticmethod
    def _job(connection, repo, context, job_id, lock=False):
        row = connection.execute("SELECT * FROM public.investigation_jobs WHERE id=%s AND org_id=%s" +
            (" FOR UPDATE" if lock else ""), (job_id, context.org_id)).fetchone()
        require(row is not None)
        require(repo.get_purchase_case(context, row["case_id"]) is not None)
        return row

    @staticmethod
    def _job_model(row):
        return Job(id=row["id"], case_id=row["case_id"], status=row["status"], stage=row["stage"],
            request=InvestigationStart.model_validate(row["request_data"]),
            provider_run_id=row["provider_run_id"], error_code=row["error_code"],
            provider_status=row.get("provider_status"), provider_finished_at=row.get("provider_finished_at"))

    async def create_job(self, user_id: UUID, case_id: UUID, key: str, data: InvestigationStart) -> tuple[Job, bool]:
        def create(connection, repo, context):
            self._case(connection, repo, context, case_id)
            TenantAuthorizer.verify_role_permission(context, [RoleEnum.BUYER, RoleEnum.ADMIN])
            from .comparison import validate_baseline
            left = self._document(connection, repo, context, case_id, data.baseline_document_id)[0]
            right = self._document(connection, repo, context, case_id, data.final_document_id)[0]
            validate_baseline(left, right)
            # Serialize creates per case so the idempotency and active-job checks are atomic.
            connection.execute("SELECT id FROM public.purchase_cases WHERE id=%s FOR UPDATE", (case_id,))
            old = connection.execute("SELECT * FROM public.investigation_jobs WHERE user_id=%s AND case_id=%s AND idempotency_key=%s",
                (user_id, case_id, key)).fetchone()
            fingerprint = request_fingerprint(data)
            if old:
                require(old["request_fingerprint"] == fingerprint, "IDEMPOTENCY_CONFLICT", "Key was used for different inputs.", 409)
                return self._job_model(old), False
            active = connection.execute("SELECT 1 FROM public.investigation_jobs WHERE case_id=%s AND status IN ('QUEUED','PROCESSING')", (case_id,)).fetchone()
            require(not active, "INVESTIGATION_ACTIVE", "A case investigation is already active.", 409)
            row = connection.execute("""INSERT INTO public.investigation_jobs
                (org_id,case_id,user_id,idempotency_key,request_fingerprint,request_data)
                VALUES (%s,%s,%s,%s,%s,%s) RETURNING *""", (context.org_id, case_id, user_id,
                key, fingerprint, Jsonb(data.model_dump(mode="json")))).fetchone()
            repo.append_audit_event(context, "INVESTIGATION_QUEUED", {"job_id": str(row["id"]), "case_id": str(case_id)})
            return self._job_model(row), True
        return await self._call(user_id, create)

    async def get_job(self, user_id: UUID, job_id: UUID) -> Job:
        def get(connection, repo, context):
            return self._job_model(self._job(connection, repo, context, job_id))
        return await self._call(user_id, get)

    async def claim_job(self, user_id: UUID, job_id: UUID) -> bool:
        def claim(connection, repo, context):
            row = self._job(connection, repo, context, job_id, lock=True)
            TenantAuthorizer.verify_role_permission(context, [RoleEnum.BUYER, RoleEnum.ADMIN])
            require(row["user_id"] == user_id, "FORBIDDEN", "Only the submitting user may execute this job.", 403)
            token = uuid4()
            claimed = connection.execute("""UPDATE public.investigation_jobs SET lease_token=%s,
                lease_until=clock_timestamp()+interval '5 minutes',status='PROCESSING',updated_at=clock_timestamp()
                WHERE id=%s AND (status='QUEUED' OR (status='PROCESSING' AND lease_until<clock_timestamp()))
                RETURNING id""", (token, job_id)).fetchone()
            return token if claimed else None
        token = await self._call(user_id, claim)
        if token:
            self.lease.set((job_id, token))
        return token is not None

    def _owned_job(self, connection, repo, context, job_id, lease):
        TenantAuthorizer.verify_role_permission(context, [RoleEnum.BUYER, RoleEnum.ADMIN])
        row = self._job(connection, repo, context, job_id, lock=True)
        require(lease and lease[0] == job_id and row["lease_token"] == lease[1]
            and row["lease_until"] > datetime.now(timezone.utc) and row["status"] == "PROCESSING"
            and row["user_id"] == context.user_id, "LEASE_LOST", "Job execution lease is no longer owned.", 409)
        return row

    async def update_job(self, user_id: UUID, job: Job) -> None:
        def update(connection, repo, context, lease):
            row = self._owned_job(connection, repo, context, job.id, lease)
            require(job.case_id == row["case_id"] and job.request.model_dump(mode="json") == row["request_data"],
                "IMMUTABLE_JOB", "Job identity and request cannot change.", 409)
            require(job.status in {"PROCESSING", "FAILED"}, "INVALID_JOB_TRANSITION", "Use atomic result persistence for terminal review states.", 409)
            connection.execute("""UPDATE public.investigation_jobs SET status=%s,stage=%s,
                provider_run_id=%s,error_code=%s,provider_status=%s,provider_finished_at=%s,updated_at=clock_timestamp(),
                lease_until=CASE WHEN %s='FAILED' THEN NULL ELSE clock_timestamp()+interval '5 minutes' END
                WHERE id=%s""", (job.status, job.stage, job.provider_run_id, job.error_code,
                    job.provider_status, job.provider_finished_at, job.status, job.id))
            if job.provider_run_id:
                case = self._case(connection, repo, context, job.case_id)
                run = connection.execute("SELECT id FROM public.public_research_runs WHERE investigation_job_id=%s",
                    (job.id,)).fetchone()
                if not run:
                    saved = repo.save_public_research_run(context, job.case_id, job.provider_run_id,
                        case.public_supplier_url, research_status(job.provider_status),
                        raw_result={"provider_status": job.provider_status})
                    run = {"id": saved.id}
                    connection.execute("UPDATE public.public_research_runs SET investigation_job_id=%s WHERE id=%s", (job.id, saved.id))
                connection.execute("""UPDATE public.public_research_runs SET status=%s,error_code=%s,
                    completed_at=%s,raw_result=%s WHERE id=%s""", (research_status(job.provider_status).value,
                    job.error_code, job.provider_finished_at, Jsonb({"provider_status": job.provider_status}), run["id"]))
        await self._call(user_id, update, self.lease.get())

    async def save_results(self, user_id: UUID, result: FindingsResponse) -> None:
        def save(connection, repo, context, lease):
            from .supabase_results import persist_results
            job = self._job(connection, repo, context, result.job_id, lock=True)
            if job["terminal_result_id"]:
                TenantAuthorizer.verify_role_permission(context, [RoleEnum.BUYER, RoleEnum.ADMIN])
                previous = connection.execute("SELECT payload FROM public.investigation_results WHERE id=%s", (job["terminal_result_id"],)).fetchone()
                require(job["user_id"] == user_id and previous["payload"] == result.model_dump(mode="json"),
                    "IMMUTABLE_RESULT", "Terminal result cannot be replaced.", 409)
                return
            row = self._owned_job(connection, repo, context, result.job_id, lease)
            case = self._case(connection, repo, context, row["case_id"])
            require(result.supplier_id == case.supplier_id, "RESULT_ASSOCIATION_INVALID", "Result supplier differs from the case.", 409)
            persist_results(connection, repo, context, row, result)
        await self._call(user_id, save, self.lease.get())

    async def get_findings(self, user_id: UUID, case_id: UUID) -> FindingsResponse:
        def get(connection, repo, context):
            self._case(connection, repo, context, case_id)
            row = connection.execute("""SELECT r.payload FROM public.investigation_results r
                JOIN public.investigation_jobs j ON j.id=r.job_id WHERE j.case_id=%s AND j.org_id=%s
                ORDER BY j.created_at DESC,j.id DESC,r.terminal DESC,r.created_at DESC LIMIT 1""",
                (case_id, context.org_id)).fetchone()
            require(row is not None, "FINDINGS_NOT_FOUND", "No investigation findings are available.", 404)
            return FindingsResponse.model_validate(row["payload"])
        return await self._call(user_id, get)

    async def save_review(self, user_id: UUID, case_id: UUID, data: Review) -> Review:
        def review(connection, repo, context):
            self._case(connection, repo, context, case_id)
            TenantAuthorizer.verify_reviewer_authority(context)
            row = self._job(connection, repo, context, data.job_id, lock=True)
            require(row["case_id"] == case_id and row["status"] in {"REVIEW_READY", "PARTIAL_REVIEW"},
                "INVALID_REVIEW", "Investigation is not awaiting review.", 409)
            decision = REVIEW_TO_DATABASE[data.decision]
            saved = repo.append_review_decision(context, case_id, decision, data.comment)
            connection.execute("UPDATE public.review_decisions SET investigation_job_id=%s WHERE id=%s", (data.job_id, saved.id))
            connection.execute("UPDATE public.investigation_jobs SET status='REVIEWED',updated_at=clock_timestamp() WHERE id=%s", (data.job_id,))
            return data
        return await self._call(user_id, review)


async def create_repository(settings: Settings) -> SupabaseAdapter:
    require(settings.database_url.get_secret_value() and settings.supabase_url
        and settings.supabase_service_role_key.get_secret_value(), "PERSISTENCE_UNCONFIGURED",
        "Supabase database and private Storage credentials are required.", 503)
    return SupabaseAdapter(settings)
