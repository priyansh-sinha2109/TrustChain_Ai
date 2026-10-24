from uuid import uuid4
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import AppError
from app.main import create_app
from app.models import Case, Document, FindingsResponse, User
from app.security import authenticate
from fake_repository import FakeRepository
from pdf_fixture import pdf_bytes


@pytest.fixture
def setup():
    owner, case_id = uuid4(), uuid4()
    repo = FakeRepository(owner)
    repo.cases[case_id] = Case(id=case_id, supplier_id=uuid4(), title="Synthetic purchase",
        supplier_name="Synthetic supplier", public_supplier_url="https://example.com")
    ids = []
    for kind, lines in [("ACCEPTED_QUOTE", ["Part number: PANEL-A", "Thickness: 8 mm",
            "Order value: INR 480000", "Advance: 30%", "Delivery: 7 days"]),
            ("FINAL_PI", ["Part number: PANEL-A", "Thickness: 6 mm", "Order value: INR 480000",
            "Advance: 80%", "Delivery: 20 days"])]:
        content = pdf_bytes(lines)
        doc = Document(id=uuid4(), case_id=case_id, document_type=kind,
            approved=kind == "ACCEPTED_QUOTE", size_bytes=len(content))
        repo.docs[doc.id] = (doc, content)
        ids.append(str(doc.id))
    app = create_app(Settings(_env_file=None), repo)
    app.dependency_overrides[authenticate] = lambda: User(id=owner)
    payload = {"baseline_document_id": ids[0], "final_document_id": ids[1], "public_research": False}
    return app, repo, case_id, payload


def test_complete_api_workflow_and_idempotency(setup):
    app, repo, case_id, data = setup
    with TestClient(app) as client:
        assert client.get(f"/api/v1/cases/{case_id}").status_code == 200
        first = client.post(f"/api/v1/cases/{case_id}/investigations", json=data,
            headers={"Idempotency-Key": "purchase-1"})
        assert first.status_code == 202
        job = first.json()["job_id"]
        assert client.get(f"/api/v1/jobs/{job}").json()["status"] == "REVIEW_READY"
        response = client.get(f"/api/v1/cases/{case_id}/findings")
        result = FindingsResponse.model_validate(response.json())
        assert result.advance_exposure.difference == 240000
        assert any(f.field_key == "material_thickness" and f.status == "CONFLICT" for f in result.findings)
        second = client.post(f"/api/v1/cases/{case_id}/investigations", json=data,
            headers={"Idempotency-Key": "purchase-1"})
        assert second.json()["job_id"] == job and len(repo.jobs) == 1
        changed = client.post(f"/api/v1/cases/{case_id}/investigations",
            json={**data, "public_research": True}, headers={"Idempotency-Key": "purchase-1"})
        assert changed.status_code == 409
        review = client.post(f"/api/v1/cases/{case_id}/reviews", json={"job_id": job,
            "decision": "REQUEST_CLARIFICATION", "comment": "Confirm changed thickness and advance."})
        assert review.status_code == 201


def test_provider_failure_preserves_private_findings(setup):
    app, repo, case_id, data = setup
    app.state.tinyfish.start_public_research = AsyncMock(side_effect=AppError("PROVIDER_QUOTA", "Unavailable", 503))
    with TestClient(app) as client:
        response = client.post(f"/api/v1/cases/{case_id}/investigations", json={**data, "public_research": True},
            headers={"Idempotency-Key": "partial"})
        assert response.status_code == 202
        result = client.get(f"/api/v1/cases/{case_id}/findings").json()
        assert result["investigation_status"] == "PARTIAL_REVIEW"
        assert result["advance_exposure"]["difference"] == "240000.00"
        assert result["findings"][-1]["status"] == "NOT_CHECKED"


def test_cross_user_access_and_missing_repository(setup):
    app, repo, case_id, data = setup
    app.dependency_overrides[authenticate] = lambda: User(id=uuid4())
    with TestClient(app) as client:
        for path in [f"/api/v1/cases/{case_id}", f"/api/v1/cases/{case_id}/documents",
                f"/api/v1/cases/{case_id}/findings"]:
            assert client.get(path).status_code == 404
    app.state.repository = None
    with TestClient(app) as client:
        assert client.get("/api/v1/cases").status_code == 503


def test_missing_idempotency_and_invalid_baseline(setup):
    app, repo, case_id, data = setup
    with TestClient(app) as client:
        assert client.post(f"/api/v1/cases/{case_id}/investigations", json=data).status_code == 422
        doc, content = repo.docs[next(iter(repo.docs))]
        repo.docs[doc.id] = (doc.model_copy(update={"approved": False}), content)
        assert client.post(f"/api/v1/cases/{case_id}/investigations", json=data,
            headers={"Idempotency-Key": "bad"}).status_code == 422


def test_all_resource_endpoints_require_authentication():
    app = create_app(Settings(_env_file=None))
    with TestClient(app) as client:
        assert client.get("/api/v1/cases").status_code == 401
        assert client.post("/api/v1/cases", json={"title": "t", "supplier_name": "s"}).status_code == 401


def test_public_observations_saved_with_real_adapter_contract(setup):
    from datetime import datetime, timezone
    from app.models import Evidence
    app, repo, case_id, data = setup
    app.state.tinyfish.start_public_research = AsyncMock(return_value="test-provider-run")
    app.state.tinyfish.get_research_run = AsyncMock(return_value={"run_id": "test-provider-run", "status": "COMPLETED"})
    app.state.tinyfish.normalize_public_result = AsyncMock(return_value=[Evidence(
        provider_run_id="test-provider-run", source_url="https://example.com",
        observation="Synthetic mocked observation", captured_at=datetime.now(timezone.utc))])
    with TestClient(app) as client:
        response = client.post(f"/api/v1/cases/{case_id}/investigations", json={**data, "public_research": True},
            headers={"Idempotency-Key": "public"})
        result = client.get(f"/api/v1/cases/{case_id}/findings").json()
        assert result["investigation_status"] == "REVIEW_READY"
        assert client.get(f"/api/v1/cases/{case_id}/evidence").json()[0]["provider_run_id"] == "test-provider-run"
        assert client.get(response.json()["poll_url"]).json()["provider_run_id"] == "test-provider-run"
    app.state.tinyfish.start_public_research.assert_awaited_once_with("https://example.com")


def test_corrupt_document_fails_job(setup):
    app, repo, case_id, data = setup
    doc_id = next(iter(repo.docs))
    doc, content = repo.docs[doc_id]
    repo.docs[doc_id] = (doc, b"corrupt")
    with TestClient(app) as client:
        response = client.post(f"/api/v1/cases/{case_id}/investigations", json=data,
            headers={"Idempotency-Key": "corrupt"})
        job = client.get(response.json()["poll_url"]).json()
        assert job["status"] == "FAILED" and job["error_code"] == "UNSUPPORTED_DOCUMENT"


def test_uncertain_provider_start_is_not_duplicated(setup):
    import asyncio
    from app.investigation import Investigator
    from app.models import InvestigationStart
    app, repo, case_id, data = setup
    owner = repo.owner
    job, _ = asyncio.run(repo.create_job(owner, case_id, "uncertain",
        InvestigationStart(**{**data, "public_research": True})))
    job.stage, job.status = "PUBLIC_STARTING", "PROCESSING"
    asyncio.run(repo.update_job(owner, job))
    app.state.tinyfish.start_public_research = AsyncMock()
    asyncio.run(Investigator(repo, app.state.tinyfish, app.state.processing_slots).execute(owner, job.id))
    app.state.tinyfish.start_public_research.assert_not_awaited()
    assert repo.jobs[job.id].error_code == "PROVIDER_START_OUTCOME_UNKNOWN"
    assert repo.results[case_id].investigation_status == "PARTIAL_REVIEW"


def test_upload_route_contracts(setup):
    from datetime import datetime, timezone
    from app.models import UploadTarget
    app, repo, case_id, data = setup
    doc = next(iter(repo.docs.values()))[0]
    repo.upload_intent = AsyncMock(return_value=UploadTarget(document_id=doc.id,
        upload_url="https://storage.test/synthetic-upload", expires_at=datetime.now(timezone.utc)))
    repo.confirm_upload = AsyncMock(return_value=doc)
    with TestClient(app) as client:
        response = client.post(f"/api/v1/cases/{case_id}/documents/upload-intents", json={
            "filename": "quote.pdf", "document_type": "ACCEPTED_QUOTE", "size_bytes": doc.size_bytes})
        assert response.status_code == 201 and response.json()["document_id"] == str(doc.id)
        confirmed = client.post(f"/api/v1/cases/{case_id}/documents/confirm", json={"document_id": str(doc.id)})
        assert confirmed.status_code == 200
        assert client.post(f"/api/v1/cases/{case_id}/documents/upload-intents", json={
            "filename": "../escape.pdf", "document_type": "RFQ", "size_bytes": 1}).status_code == 422


def test_committed_openapi_matches_application():
    import json
    from pathlib import Path
    schema = Path(__file__).resolve().parents[2] / "docs" / "backend-openapi.json"
    assert json.loads(schema.read_text(encoding="utf-8")) == create_app(Settings(_env_file=None)).openapi()


def test_explicit_approval_endpoint_delegates_with_verified_identity(setup):
    app, repo, case_id, data = setup
    document = next(iter(repo.docs.values()))[0]
    repo.approve_document = AsyncMock(return_value=document)
    with TestClient(app) as client:
        response = client.post(f"/api/v1/cases/{case_id}/documents/{document.id}/approval",
            json={"note": "Engineering accepted the purchasing baseline."})
        assert response.status_code == 200
    repo.approve_document.assert_awaited_once_with(repo.owner, case_id, document.id,
        "Engineering accepted the purchasing baseline.")


async def test_stale_worker_stops_without_marking_replacement_failed(setup):
    from app.investigation import Investigator
    from app.models import InvestigationStart
    app,repo,case_id,data=setup
    job,_=await repo.create_job(repo.owner,case_id,"stale-worker",InvestigationStart(**data))
    repo.update_job=AsyncMock(side_effect=AppError("LEASE_LOST","A replacement owns the job",409))
    await Investigator(repo,app.state.tinyfish,app.state.processing_slots).execute(repo.owner,job.id)
    assert repo.update_job.await_count==1


def test_private_pdf_preview_uses_authorized_bytes_and_disables_caching(setup):
    app,repo,case_id,data=setup
    document,content=next(iter(repo.docs.values()))
    with TestClient(app) as client:
        response=client.get(f"/api/v1/cases/{case_id}/documents/{document.id}/content")
        assert response.status_code==200 and response.content==content
        assert response.headers["content-type"]=="application/pdf"
        assert response.headers["cache-control"]=="private, no-store"
        app.dependency_overrides[authenticate]=lambda:User(id=uuid4())
        assert client.get(f"/api/v1/cases/{case_id}/documents/{document.id}/content").status_code==404
