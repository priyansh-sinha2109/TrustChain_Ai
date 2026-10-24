"""Test-only adapter. Not a persistence implementation or production fallback."""
from uuid import uuid4

from app.errors import AppError
from app.models import Case, Job


class FakeRepository:
    def __init__(self, owner):
        self.owner, self.cases, self.docs, self.jobs, self.keys, self.results = owner, {}, {}, {}, {}, {}
        self.claimed = set()

    def authorize(self, user):
        if user != self.owner:
            raise AppError("NOT_FOUND", "Resource not found.", 404)

    async def create_case(self, user, data):
        self.authorize(user)
        case = Case(id=uuid4(), supplier_id=uuid4(), **data.model_dump())
        self.cases[case.id] = case
        return case

    async def list_cases(self, user):
        self.authorize(user)
        return list(self.cases.values())

    async def get_case(self, user, case_id):
        self.authorize(user)
        if case_id not in self.cases:
            raise AppError("NOT_FOUND", "Resource not found.", 404)
        return self.cases[case_id]

    async def list_documents(self, user, case_id):
        await self.get_case(user, case_id)
        return [doc for doc, _ in self.docs.values() if doc.case_id == case_id]

    async def document_bytes(self, user, case_id, document_id):
        await self.get_case(user, case_id)
        item = self.docs.get(document_id)
        if not item or item[0].case_id != case_id:
            raise AppError("NOT_FOUND", "Resource not found.", 404)
        return item

    async def create_job(self, user, case_id, key, data):
        await self.get_case(user, case_id)
        identity = (user, case_id, key)
        if identity in self.keys:
            job = self.jobs[self.keys[identity]]
            if job.request != data:
                raise AppError("IDEMPOTENCY_CONFLICT", "Key already used for different inputs.", 409)
            return job.model_copy(deep=True), False
        job = Job(id=uuid4(), case_id=case_id, status="QUEUED", stage="QUEUED", request=data)
        self.jobs[job.id] = job.model_copy(deep=True)
        self.keys[identity] = job.id
        return job, True

    async def get_job(self, user, job_id):
        self.authorize(user)
        if job_id not in self.jobs:
            raise AppError("NOT_FOUND", "Resource not found.", 404)
        return self.jobs[job_id].model_copy(deep=True)

    async def claim_job(self, user, job_id):
        job = await self.get_job(user, job_id)
        if job_id in self.claimed or job.status not in {"QUEUED", "PROCESSING"}:
            return False
        self.claimed.add(job_id)
        return True

    async def update_job(self, user, job):
        self.authorize(user)
        self.jobs[job.id] = job.model_copy(deep=True)

    async def save_results(self, user, result):
        self.authorize(user)
        self.results[result.case_id] = result.model_copy(deep=True)
        if result.investigation_status != "PROCESSING":
            job = self.jobs[result.job_id]
            job.status, job.stage = result.investigation_status, "REVIEW_READY"

    async def get_findings(self, user, case_id):
        await self.get_case(user, case_id)
        if case_id not in self.results:
            raise AppError("NOT_FOUND", "No findings available.", 404)
        return self.results[case_id]

    async def save_review(self, user, case_id, data):
        await self.get_case(user, case_id)
        self.jobs[data.job_id].status = "REVIEWED"
        return data
