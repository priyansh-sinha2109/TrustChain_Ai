"""One SQL transaction persists immutable snapshots and Member 3's evidence graph."""
import hashlib
import json
from decimal import Decimal
from uuid import UUID, uuid5

from psycopg.types.json import Jsonb

from .errors import AppError
from .database_mapping import SEVERITY_TO_DATABASE, finding_details
from trustchain.database.models import (EvidenceSource, EvidenceKindEnum, Finding as DatabaseFinding,
    DealChange, ChangeCategoryEnum, DealStageEnum)


def persist_results(connection, repo, context, job, result):
    if (result.case_id != job["case_id"] or str(result.baseline_document_id) != job["request_data"]["baseline_document_id"]
            or str(result.final_document_id) != job["request_data"]["final_document_id"]):
        raise AppError("RESULT_ASSOCIATION_INVALID", "Result does not belong to the job request.", 409)
    terminal = result.investigation_status in {"REVIEW_READY", "PARTIAL_REVIEW"}
    if not terminal and result.investigation_status != "PROCESSING":
        raise AppError("INVALID_RESULT_STATUS", "Result status is not supported.", 409)
    payload = result.model_dump(mode="json")
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    old = connection.execute("SELECT id,payload FROM public.investigation_results WHERE job_id=%s AND terminal=%s",
        (result.job_id, terminal)).fetchone()
    if old:
        if old["payload"] != payload:
            # Processing extraction on resume may have a new retrieval timestamp. Reuse
            # its private snapshot, but never replace terminal history.
            if terminal:
                raise AppError("IMMUTABLE_RESULT", "A different terminal result already exists.", 409)
        return
    row = connection.execute("""INSERT INTO public.investigation_results
        (job_id,terminal,payload,payload_fingerprint) VALUES (%s,%s,%s,%s) RETURNING id""",
        (result.job_id, terminal, Jsonb(payload), fingerprint)).fetchone()
    if terminal:
        project_evidence(connection, repo, context, result)
    repo.append_audit_event(context, "INVESTIGATION_RESULT_SAVED", {"job_id": str(result.job_id), "terminal": terminal})
    if terminal:
        connection.execute("""UPDATE public.investigation_jobs SET status=%s,stage='REVIEW_READY',
            terminal_result_id=%s,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=%s""",
            (result.investigation_status, row["id"], result.job_id))


def project_evidence(connection, repo, context, result):
    """Use existing tables/models; all writes share the caller's PostgreSQL transaction."""
    job_id, case_id = result.job_id, result.case_id
    documents = {r["id"]: r for r in connection.execute(
        "SELECT * FROM public.documents WHERE case_id=%s AND id=ANY(%s) FOR SHARE",
        (case_id, [result.baseline_document_id, result.final_document_id])).fetchall()}
    if len(documents) != 2:
        raise AppError("RESULT_ASSOCIATION_INVALID", "Result documents are not registered to this case.", 409)

    def source_key(field):
        return json.dumps(field.model_dump(mode="json"), sort_keys=True)

    source_ids = {}
    for index, field in enumerate(result.extracted_fields):
        document = documents.get(field.document_id)
        if not document or document["doc_type"] != field.document_type.value:
            raise AppError("RESULT_ASSOCIATION_INVALID", "Source field is not associated with the selected documents.", 409)
        source_id = uuid5(job_id, f"private-source:{index}")
        source_ids.setdefault(source_key(field), source_id)
        source = EvidenceSource(id=source_id, case_id=case_id, kind=EvidenceKindEnum.PRIVATE_PDF,
            document_id=field.document_id, page_number=field.page_number, extracted_text=field.raw_text,
            metadata_json=field.model_dump(mode="json"))
        repo.save_evidence_sources(context, [source])
        connection.execute("UPDATE public.evidence_sources SET investigation_job_id=%s WHERE id=%s", (job_id, source_id))
        connection.execute("""INSERT INTO public.claims
            (id,case_id,source_id,field_key,claim_value,investigation_job_id) VALUES (%s,%s,%s,%s,%s,%s)""",
            (uuid5(job_id, f"claim:{index}"), case_id, source_id, field.field_key,
                Jsonb(field.model_dump(mode="json")), job_id))
    for index, observation in enumerate(result.evidence):
        if observation.provider_run_id != connection.execute(
                "SELECT provider_run_id FROM public.investigation_jobs WHERE id=%s", (job_id,)).fetchone()["provider_run_id"]:
            raise AppError("RESULT_ASSOCIATION_INVALID", "Public evidence belongs to another provider run.", 409)
        source = EvidenceSource(id=uuid5(job_id, f"public-source:{index}"), case_id=case_id,
            kind=EvidenceKindEnum.PUBLIC_WEB, source_url=observation.source_url,
            extracted_text=observation.observation, captured_at=observation.captured_at,
            metadata_json={"provider_run_id": observation.provider_run_id,
                "provider_finished_at": observation.provider_finished_at})
        repo.save_evidence_sources(context, [source])
        connection.execute("UPDATE public.evidence_sources SET investigation_job_id=%s,captured_at=%s WHERE id=%s",
            (job_id, observation.captured_at, source.id))

    def scalar(document_id, key):
        values = {(field.value, field.unit) for field in result.extracted_fields
            if field.document_id == document_id and field.field_key == key}
        if len(values) != 1 or next(iter(values))[1] == "UNSUPPORTED":
            return None
        return next(iter(values))[0]

    versions = []
    # Lock the case to serialize version numbering across existing teammate writes.
    connection.execute("SELECT id FROM public.purchase_cases WHERE id=%s FOR UPDATE", (case_id,))
    for label, document_id in [("baseline", result.baseline_document_id), ("final", result.final_document_id)]:
        version_id = uuid5(job_id, f"version:{label}")
        stage = DealStageEnum(documents[document_id]["doc_type"])
        version_no = connection.execute("SELECT COALESCE(MAX(version_no),0)+1 AS n FROM public.deal_versions WHERE case_id=%s AND stage=%s",
            (case_id, stage.value)).fetchone()["n"]
        total, advance, delivery = [scalar(document_id, key) for key in ("total_amount", "advance_percentage", "delivery_days")]
        currencies = {field.unit for field in result.extracted_fields if field.document_id == document_id
            and field.field_key in {"total_amount", "advance_amount", "unit_price"}
            and field.unit and field.unit != "UNSUPPORTED"}
        currencies |= {field.value.upper() for field in result.extracted_fields
            if field.document_id == document_id and field.field_key == "currency"}
        currency = next(iter(currencies)) if len(currencies) == 1 else None
        if currency and (len(currency) != 3 or not currency.isalpha()):
            currency = None
        if total is not None and advance is not None:
            repo.save_deal_version(context, case_id, stage, total, advance, supplier_id=result.supplier_id,
                document_id=document_id, version_no=version_no,
                delivery_timeline_days=int(delivery) if delivery is not None else None, deal_version_id=version_id)
        else:
            # SQL permits missing terms; Member 3's dataclass requires both values.
            # Keep SQL NULL rather than using to_decimal(None), which means zero there.
            connection.execute("""INSERT INTO public.deal_versions
                (id,case_id,supplier_id,document_id,stage,version_no,total_amount,advance_percentage,delivery_timeline_days)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""", (version_id, case_id, result.supplier_id,
                    document_id, stage.value, version_no, Decimal(total) if total is not None else None,
                    Decimal(advance) if advance is not None else None, int(delivery) if delivery is not None else None))
        connection.execute("UPDATE public.deal_versions SET investigation_job_id=%s,currency=%s WHERE id=%s", (job_id, currency, version_id))
        versions.append(version_id)

    for index, finding in enumerate(result.findings):
        finding_id = uuid5(job_id, f"finding:{index}")
        references = []
        for field in finding.baseline + finding.final:
            if source_key(field) not in source_ids:
                raise AppError("SOURCE_REFERENCE_MISSING", "Finding source is missing from extracted fields.", 409)
            references.append(str(source_ids[source_key(field)]))
        record = DatabaseFinding(id=finding_id, case_id=case_id,
            severity=SEVERITY_TO_DATABASE[finding.severity], summary=finding.explanation,
            status="OPEN", details={**finding_details(finding), "source_ids": references})
        repo.save_findings(context, [record])
        connection.execute("UPDATE public.findings SET investigation_job_id=%s WHERE id=%s", (job_id, finding_id))
        if finding.status == "CONFLICT" and finding.category in {"TECHNICAL", "COMMERCIAL"}:
            impact = (result.advance_exposure.difference if finding.field_key == "advance_percentage"
                and result.advance_exposure.currency == "INR" else None)
            change = DealChange(id=uuid5(job_id, f"change:{index}"), case_id=case_id,
                finding_id=finding_id, baseline_version_id=versions[0], final_version_id=versions[1],
                field_key=finding.field_key, category=ChangeCategoryEnum(finding.category),
                before_value={"sources": [f.model_dump(mode="json") for f in finding.baseline]},
                after_value={"sources": [f.model_dump(mode="json") for f in finding.final]},
                baseline_page=finding.baseline[0].page_number if finding.baseline else None,
                final_page=finding.final[0].page_number if finding.final else None,
                financial_impact_inr=impact if impact is not None else Decimal("0"))
            repo.save_deal_changes(context, [change])
            connection.execute("UPDATE public.deal_changes SET investigation_job_id=%s,financial_impact_inr=%s WHERE id=%s",
                (job_id, impact, change.id))
