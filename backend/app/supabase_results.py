"""Atomic, immutable job snapshots; relational evidence projection is added separately."""
import hashlib
import json

from psycopg.types.json import Jsonb

from .errors import AppError


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
    repo.append_audit_event(context, "INVESTIGATION_RESULT_SAVED", {"job_id": str(result.job_id), "terminal": terminal})
    if terminal:
        connection.execute("""UPDATE public.investigation_jobs SET status=%s,stage='REVIEW_READY',
            terminal_result_id=%s,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=%s""",
            (result.investigation_status, row["id"], result.job_id))
