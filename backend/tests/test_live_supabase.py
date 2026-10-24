"""Opt-in real Supabase Auth, SQL and Storage test. Creates labelled synthetic data.

Requires TRUSTCHAIN_LIVE_TESTS=1 and TRUSTCHAIN_TEST_PROJECT_REF matching SUPABASE_URL,
DATABASE_URL, service/anon keys and buyer/reviewer access tokens in the ignored .env.
No automatic cleanup deletes audit history or shared data. Never target production.
"""
import asyncio
from pathlib import Path
from urllib.parse import urlsplit

import httpx
import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.supabase_adapter import create_repository
from pdf_fixture import pdf_bytes


def live_config():
    import os
    values={**dotenv_values(Path(__file__).resolve().parents[2]/".env"),**os.environ}
    if values.get("TRUSTCHAIN_LIVE_TESTS")!="1":
        pytest.skip("Live Supabase tests are not explicitly enabled")
    settings=Settings()
    project=values.get("TRUSTCHAIN_TEST_PROJECT_REF")
    assert project and urlsplit(settings.supabase_url).hostname==f"{project}.supabase.co", "Dedicated test project must be explicitly identified"
    required=["DATABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_ANON_KEY",
        "TRUSTCHAIN_TEST_BUYER_ACCESS_TOKEN","TRUSTCHAIN_TEST_REVIEWER_ACCESS_TOKEN"]
    missing=[name for name in required if not values.get(name)]
    if missing:
        pytest.skip("Missing live configuration: "+", ".join(missing))
    return settings,values


def test_authenticated_live_supabase_workflow():
    settings,values=live_config()
    adapter=asyncio.run(create_repository(settings))
    app=create_app(settings,adapter)
    secret=settings.supabase_service_role_key.get_secret_value()
    with TestClient(app) as client:
        client.headers["Authorization"]="Bearer "+values["TRUSTCHAIN_TEST_BUYER_ACCESS_TOKEN"]
        me=client.get("/api/v1/me")
        assert me.status_code==200,"Live buyer authentication failed"
        buyer_id=me.json()["id"]
        case=client.post("/api/v1/cases",json={"title":"SYNTHETIC integration verification",
            "supplier_name":"SYNTHETIC TEST FIXTURE - not a supplier claim","public_supplier_url":"https://example.com"})
        assert case.status_code==201,case.text
        case_id=case.json()["id"]
        docs=[]
        for kind,thickness,pct in [("ACCEPTED_QUOTE",8,30),("FINAL_PI",6,80)]:
            content=pdf_bytes(["Product: SYNTHETIC TEST FIXTURE","Part number: SYNTHETIC-PANEL",
                f"Thickness: {thickness} mm","Order value: INR 480000",f"Advance: {pct}%"])
            ticket=client.post(f"/api/v1/cases/{case_id}/documents/upload-intents",json={
                "filename":"synthetic.pdf","document_type":kind,"size_bytes":len(content)})
            assert ticket.status_code==201,ticket.text
            with httpx.Client(timeout=30,follow_redirects=False) as storage:
                uploaded=storage.put(ticket.json()["upload_url"],content=content,headers={"Content-Type":"application/pdf"})
            assert uploaded.status_code in (200,201),"Real signed private upload failed"
            doc_id=ticket.json()["document_id"]
            confirmed=client.post(f"/api/v1/cases/{case_id}/documents/confirm",json={"document_id":doc_id})
            assert confirmed.status_code==200 and not confirmed.json()["approved"],confirmed.text
            docs.append(doc_id)
        client.headers["Authorization"]="Bearer "+values["TRUSTCHAIN_TEST_REVIEWER_ACCESS_TOKEN"]
        approval=client.post(f"/api/v1/cases/{case_id}/documents/{docs[0]}/approval",json={"note":"SYNTHETIC fixture approval for integration test"})
        assert approval.status_code==200,approval.text
        client.headers["Authorization"]="Bearer "+values["TRUSTCHAIN_TEST_BUYER_ACCESS_TOKEN"]
        started=client.post(f"/api/v1/cases/{case_id}/investigations",json={"baseline_document_id":docs[0],
            "final_document_id":docs[1],"public_research":False},headers={"Idempotency-Key":"synthetic-live-case"})
        assert started.status_code==202,started.text
        job=client.get(started.json()["poll_url"])
        assert job.json()["status"]=="REVIEW_READY",job.text
        findings=client.get(f"/api/v1/cases/{case_id}/findings")
        assert findings.status_code==200 and findings.json()["advance_exposure"]["difference"]=="240000.00",findings.text
        assert secret not in findings.text and secret not in started.text
        client.headers["Authorization"]="Bearer "+values["TRUSTCHAIN_TEST_REVIEWER_ACCESS_TOKEN"]
        review=client.post(f"/api/v1/cases/{case_id}/reviews",json={"job_id":started.json()["job_id"],
            "decision":"REQUEST_CLARIFICATION","comment":"SYNTHETIC fixture - no real purchasing authority exercised"})
        assert review.status_code==201,review.text


async def test_controlled_live_tinyfish_smoke():
    settings,values=live_config()
    if not settings.tinyfish_api_key.get_secret_value():
        pytest.skip("TinyFish key is not configured")
    from app.tinyfish import TinyFish
    provider=TinyFish(settings)
    run_id=await provider.start_public_research("https://example.com",smoke=True)
    async with asyncio.timeout(230):
        while True:
            run=await provider.get_research_run(run_id)
            if run["status"] in {"COMPLETED","FAILED","CANCELLED"}:
                break
            await asyncio.sleep(5)
    assert run["status"]=="COMPLETED","Real TinyFish run did not complete successfully"
    assert await provider.normalize_public_result(run,"https://example.com"),"Real provider returned no usable observations"
