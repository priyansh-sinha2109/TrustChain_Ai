from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, Request
from fastapi.responses import Response

from .comparison import validate_baseline
from .errors import AppError
from .investigation import Investigator
from .models import (Case, CaseCreate, Document, FindingsResponse, InvestigationStart,
                     Job, JobAccepted, Review, UploadConfirm, UploadIntent, UploadTarget, User, Evidence)
from .models import DocumentApproval, Membership, WorkspaceCreate
from .security import authenticate

router = APIRouter(prefix="/api/v1", dependencies=[Depends(authenticate)])
CurrentUser = Annotated[User, Depends(authenticate)]


def repository(request: Request):
    repo = request.app.state.repository
    if repo is None:
        raise AppError("PERSISTENCE_UNAVAILABLE", "The Supabase repository adapter is not configured.", 503)
    return repo


Repo = Annotated[object, Depends(repository)]


@router.get("/membership", response_model=Membership)
async def membership(user: CurrentUser, repo: Repo):
    return await repo.get_membership(user.id)


@router.post("/onboarding/workspace", response_model=Membership)
async def create_workspace(data: WorkspaceCreate, user: CurrentUser, repo: Repo):
    return await repo.create_workspace(user.id, data)


def investigator(request: Request, repo):
    return Investigator(repo, request.app.state.tinyfish, request.app.state.processing_slots)


@router.post("/cases", response_model=Case, status_code=201)
async def create_case(data: CaseCreate, user: CurrentUser, repo: Repo):
    return await repo.create_case(user.id, data)


@router.get("/cases", response_model=list[Case])
async def list_cases(user: CurrentUser, repo: Repo):
    return await repo.list_cases(user.id)


@router.get("/cases/{case_id}", response_model=Case)
async def get_case(case_id: UUID, user: CurrentUser, repo: Repo):
    return await repo.get_case(user.id, case_id)


@router.post("/cases/{case_id}/documents/upload-intents", response_model=UploadTarget, status_code=201)
async def upload(case_id: UUID, data: UploadIntent, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    return await repo.upload_intent(user.id, case_id, data)


@router.post("/cases/{case_id}/documents/confirm", response_model=Document)
async def confirm(case_id: UUID, data: UploadConfirm, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    return await repo.confirm_upload(user.id, case_id, data.document_id)


@router.get("/cases/{case_id}/documents", response_model=list[Document])
async def documents(case_id: UUID, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    return await repo.list_documents(user.id, case_id)


@router.post("/cases/{case_id}/documents/{document_id}/approval", response_model=Document)
async def approve_document(case_id: UUID, document_id: UUID, data: DocumentApproval, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    if not hasattr(repo, "approve_document"):
        raise AppError("APPROVAL_UNAVAILABLE", "Document approval is not supported by the configured adapter.", 503)
    return await repo.approve_document(user.id, case_id, document_id, data.note)


@router.get("/cases/{case_id}/documents/{document_id}/content", response_class=Response,
            responses={200: {"content": {"application/pdf": {}}}})
async def document_content(case_id: UUID, document_id: UUID, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    _, content = await repo.document_bytes(user.id, case_id, document_id)
    return Response(content, media_type="application/pdf", headers={
        "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="purchase-document.pdf"'})


@router.post("/cases/{case_id}/investigations", response_model=JobAccepted, status_code=202)
async def start(case_id: UUID, data: InvestigationStart, request: Request,
                background: BackgroundTasks, user: CurrentUser, repo: Repo,
                key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=128)]):
    await repo.get_case(user.id, case_id)
    docs = await repo.list_documents(user.id, case_id)
    by_id = {doc.id: doc for doc in docs}
    if data.baseline_document_id not in by_id or data.final_document_id not in by_id:
        raise AppError("DOCUMENT_NOT_FOUND", "Select documents belonging to this case.", 404)
    validate_baseline(by_id[data.baseline_document_id], by_id[data.final_document_id])
    job, created = await repo.create_job(user.id, case_id, key, data)
    if created:
        background.add_task(investigator(request, repo).execute, user.id, job.id)
    return JobAccepted(job_id=job.id, status=job.status, poll_url=f"/api/v1/jobs/{job.id}")


@router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: UUID, user: CurrentUser, repo: Repo):
    return await repo.get_job(user.id, job_id)


@router.post("/jobs/{job_id}/resume", response_model=JobAccepted, status_code=202)
async def resume(job_id: UUID, request: Request, background: BackgroundTasks, user: CurrentUser, repo: Repo):
    job = await repo.get_job(user.id, job_id)
    if job.status not in {"QUEUED", "PROCESSING"}:
        raise AppError("JOB_NOT_RESUMABLE", "Only queued or interrupted processing jobs can resume.", 409)
    background.add_task(investigator(request, repo).execute, user.id, job.id)
    return JobAccepted(job_id=job.id, status=job.status, poll_url=f"/api/v1/jobs/{job.id}")


@router.get("/cases/{case_id}/findings", response_model=FindingsResponse)
async def findings(case_id: UUID, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    return await repo.get_findings(user.id, case_id)


@router.get("/cases/{case_id}/evidence", response_model=list[Evidence])
async def evidence(case_id: UUID, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    return (await repo.get_findings(user.id, case_id)).evidence


@router.post("/cases/{case_id}/reviews", response_model=Review, status_code=201)
async def review(case_id: UUID, data: Review, user: CurrentUser, repo: Repo):
    await repo.get_case(user.id, case_id)
    job = await repo.get_job(user.id, data.job_id)
    if job.case_id != case_id or job.status not in {"REVIEW_READY", "PARTIAL_REVIEW"}:
        raise AppError("INVALID_REVIEW", "Select a review-ready investigation in this case.", 409)
    return await repo.save_review(user.id, case_id, data)
