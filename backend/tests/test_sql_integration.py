"""Real PostgreSQL transactions with synthetic identities and mocked Supabase HTTP.

Opt in with TRUSTCHAIN_TEST_DATABASE_URL pointing at an isolated migrated database.
This does NOT claim live Supabase Auth, Storage, or TinyFish verification.
"""
import os
from uuid import uuid4, UUID

import httpx
import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.config import Settings
from app.main import create_app
from app.models import User
from app.security import authenticate
from app.supabase_adapter import SupabaseAdapter
from trustchain.database.storage import StorageService
from pdf_fixture import pdf_bytes

TEST_URL = os.getenv("TRUSTCHAIN_TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(not TEST_URL, reason="Dedicated PostgreSQL test URL is not configured")


@pytest.fixture
def sql_environment():
    org, buyer, reviewer, outsider = [uuid4() for _ in range(4)]
    with psycopg.connect(TEST_URL) as connection:
        connection.execute("INSERT INTO public.organizations(id,name,slug) VALUES (%s,%s,%s)",
            (org, "Synthetic integration fixture", str(org)))
        connection.execute("INSERT INTO public.organization_members(org_id,user_id,role) VALUES (%s,%s,'buyer'),(%s,%s,'reviewer')",
            (org,buyer,org,reviewer))
        other_org=uuid4()
        connection.execute("INSERT INTO public.organizations(id,name,slug) VALUES (%s,%s,%s)",
            (other_org,"Synthetic other tenant",str(other_org)))
        connection.execute("INSERT INTO public.organization_members(org_id,user_id,role) VALUES (%s,%s,'buyer')",(other_org,outsider))
    objects, requests = {}, []
    def storage_http(request):
        requests.append(request)
        path = request.url.path.removeprefix("/storage/v1")
        if request.method == "POST":
            return httpx.Response(200, json={"url" if "/upload/" in path else "signedURL": path + "?token=mocked-storage-token"})
        key = path.removeprefix("/object/sign/case-documents/")
        if key not in objects:
            return httpx.Response(404)
        return httpx.Response(200,content=objects[key],headers={"Content-Type":"application/pdf"})
    settings = Settings(_env_file=None,supabase_url="https://isolated.supabase.test",
        supabase_anon_key="mocked-anon",supabase_service_role_key="mocked-service",database_url=TEST_URL)
    storage = StorageService(settings.supabase_url,"mocked-service",transport=httpx.MockTransport(storage_http))
    adapter = SupabaseAdapter(settings,storage=storage)
    app = create_app(settings,adapter)
    identity = {"id":buyer}
    app.dependency_overrides[authenticate] = lambda: User(id=identity["id"])
    return app,adapter,identity,objects,requests,org,buyer,reviewer,outsider


def prepare_case(client, env, currency="INR"):
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=env
    response=client.post("/api/v1/cases",json={"title":"Synthetic panel purchase","supplier_name":"SYNTHETIC supplier",
        "public_supplier_url":"https://example.com"})
    assert response.status_code==201,response.text
    case_id=response.json()["id"]
    docs=[]
    for kind,thickness,advance,days in [("ACCEPTED_QUOTE",8,30,7),("FINAL_PI",6,80,20)]:
        content=pdf_bytes(["Part number: PANEL-A",f"Thickness: {thickness} mm",f"Order value: {currency} 480000",
            f"Advance: {advance}%",f"Delivery: {days} days"])
        ticket=client.post(f"/api/v1/cases/{case_id}/documents/upload-intents",json={"filename":kind+".pdf",
            "document_type":kind,"size_bytes":len(content)})
        assert ticket.status_code==201,ticket.text
        document_id=ticket.json()["document_id"]
        key=f"{org}/{case_id}/{document_id}.pdf"
        # Missing object cannot be marked uploaded.
        absent=client.post(f"/api/v1/cases/{case_id}/documents/confirm",json={"document_id":document_id})
        assert absent.status_code==404,absent.text
        objects[key]=content
        confirmed=client.post(f"/api/v1/cases/{case_id}/documents/confirm",json={"document_id":document_id})
        assert confirmed.status_code==200,confirmed.text
        assert confirmed.json()["approved"] is False
        docs.append(document_id)
    buyer_approval=client.post(f"/api/v1/cases/{case_id}/documents/{docs[0]}/approval",json={"note":"Buyer cannot self-approve"})
    assert buyer_approval.status_code==403,buyer_approval.text
    identity["id"]=reviewer
    invalid_approval=client.post(f"/api/v1/cases/{case_id}/documents/{docs[1]}/approval",json={"note":"Final PI is not an accepted baseline"})
    assert invalid_approval.status_code==422,invalid_approval.text
    approved=client.post(f"/api/v1/cases/{case_id}/documents/{docs[0]}/approval",json={"note":"Synthetic accepted baseline approval"})
    assert approved.status_code==200,approved.text
    identity["id"]=buyer
    return case_id,{"baseline_document_id":docs[0],"final_document_id":docs[1],"public_research":False}


def test_real_sql_document_job_findings_and_review(sql_environment):
    env=sql_environment
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=env
    with TestClient(app) as client:
        case_id,payload=prepare_case(client,env)
        response=client.post(f"/api/v1/cases/{case_id}/investigations",json=payload,headers={"Idempotency-Key":"sql-test"})
        assert response.status_code==202,response.text
        poll=response.json()["poll_url"]
        job=client.get(poll)
        assert job.json()["status"]=="REVIEW_READY",job.text
        result=client.get(f"/api/v1/cases/{case_id}/findings")
        assert result.status_code==200,result.text
        assert result.json()["advance_exposure"]["difference"]=="240000.00"
        import asyncio
        from app.models import FindingsResponse
        asyncio.run(adapter.save_results(buyer,FindingsResponse.model_validate(result.json())))
        duplicate=client.post(f"/api/v1/cases/{case_id}/investigations",json=payload,headers={"Idempotency-Key":"sql-test"})
        assert duplicate.json()["job_id"]==response.json()["job_id"]
        denied=client.post(f"/api/v1/cases/{case_id}/reviews",json={"job_id":response.json()["job_id"],
            "decision":"REQUEST_CLARIFICATION","comment":"Synthetic fixture review"})
        assert denied.status_code==403,denied.text
        identity["id"]=reviewer
        reviewed=client.post(f"/api/v1/cases/{case_id}/reviews",json={"job_id":response.json()["job_id"],
            "decision":"REQUEST_CLARIFICATION","comment":"Synthetic fixture review"})
        assert reviewed.status_code==201,reviewed.text
        with psycopg.connect(TEST_URL,row_factory=dict_row) as connection:
            assert connection.execute("SELECT count(*) AS n FROM public.findings WHERE investigation_job_id=%s",
                (response.json()["job_id"],)).fetchone()["n"]>=8
            assert connection.execute("SELECT count(*) AS n FROM public.claims WHERE investigation_job_id=%s",
                (response.json()["job_id"],)).fetchone()["n"]==10
            assert {r["currency"] for r in connection.execute("SELECT currency FROM public.deal_versions WHERE investigation_job_id=%s",
                (response.json()["job_id"],)).fetchall()}=={"INR"}
        identity["id"]=outsider
        assert client.get(f"/api/v1/cases/{case_id}").status_code==403
    # New application/adapter instance retrieves the same immutable persisted result.
    replacement=SupabaseAdapter(app.state.settings,storage=adapter.storage)
    restarted=create_app(app.state.settings,replacement)
    restarted.dependency_overrides[authenticate]=lambda:User(id=buyer)
    with TestClient(restarted) as client:
        saved=client.get(f"/api/v1/cases/{case_id}/findings")
        assert saved.status_code==200,saved.text
        assert saved.json()["advance_exposure"]["difference"]=="240000.00"


def test_real_sql_partial_results_and_provider_metadata(sql_environment):
    from unittest.mock import AsyncMock
    from app.errors import AppError
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=sql_environment
    app.state.tinyfish.start_public_research=AsyncMock(return_value="synthetic-provider-wire-test")
    app.state.tinyfish.get_research_run=AsyncMock(side_effect=AppError("PROVIDER_TIMEOUT","Synthetic test timeout",503))
    with TestClient(app) as client:
        case_id,payload=prepare_case(client,sql_environment)
        response=client.post(f"/api/v1/cases/{case_id}/investigations",json={**payload,"public_research":True},
            headers={"Idempotency-Key":"sql-partial"})
        job=client.get(response.json()["poll_url"]).json()
        assert job["status"]=="PARTIAL_REVIEW" and job["provider_run_id"]=="synthetic-provider-wire-test"
        result=client.get(f"/api/v1/cases/{case_id}/findings").json()
        assert result["advance_exposure"]["difference"]=="240000.00" and result["findings"][-1]["status"]=="NOT_CHECKED"
        with psycopg.connect(TEST_URL,row_factory=dict_row) as connection:
            run=connection.execute("SELECT tinyfish_run_id,error_code,completed_at FROM public.public_research_runs WHERE investigation_job_id=%s",
                (job["id"],)).fetchone()
            assert run["tinyfish_run_id"]=="synthetic-provider-wire-test" and run["completed_at"] is None
            assert run["error_code"]=="PROVIDER_TIMEOUT"


def test_real_sql_transaction_rolls_back_partial_projection(sql_environment,monkeypatch):
    from trustchain.database.repository import SupabaseRepository
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=sql_environment
    def fail_projection(*args,**kwargs):
        raise RuntimeError("Synthetic projection failure")
    monkeypatch.setattr(SupabaseRepository,"save_findings",fail_projection)
    with TestClient(app) as client:
        case_id,payload=prepare_case(client,sql_environment)
        response=client.post(f"/api/v1/cases/{case_id}/investigations",json=payload,headers={"Idempotency-Key":"sql-rollback"})
        job=client.get(response.json()["poll_url"]).json()
        assert job["status"]=="FAILED",job
        with psycopg.connect(TEST_URL,row_factory=dict_row) as connection:
            for table in ["findings","claims","deal_versions","evidence_sources"]:
                from psycopg import sql
                count=connection.execute(sql.SQL("SELECT count(*) AS n FROM public.{} WHERE investigation_job_id=%s").format(sql.Identifier(table)),
                    (job["id"],)).fetchone()["n"]
                assert count==0,table
            assert connection.execute("SELECT count(*) AS n FROM public.investigation_results WHERE job_id=%s AND terminal",
                (job["id"],)).fetchone()["n"]==0
        # Independently committed private snapshot remains accessible after terminal rollback.
        assert client.get(f"/api/v1/cases/{case_id}/findings").json()["advance_exposure"]["difference"]=="240000.00"


async def prepare_adapter(env):
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=env
    from app.models import CaseCreate,UploadIntent,InvestigationStart
    case=await adapter.create_case(buyer,CaseCreate(title="Synthetic concurrency fixture",supplier_name="SYNTHETIC"))
    docs=[]
    for kind in ["ACCEPTED_QUOTE","FINAL_PI"]:
        content=pdf_bytes(["Thickness: 8 mm","Order value: INR 100","Advance: 30%"])
        target=await adapter.upload_intent(buyer,case.id,UploadIntent(filename="fixture.pdf",document_type=kind,size_bytes=len(content)))
        objects[f"{org}/{case.id}/{target.document_id}.pdf"]=content
        await adapter.confirm_upload(buyer,case.id,target.document_id)
        docs.append(target.document_id)
    await adapter.approve_document(reviewer,case.id,docs[0],"Synthetic approved fixture")
    return case,InvestigationStart(baseline_document_id=docs[0],final_document_id=docs[1],public_research=False)


async def test_real_sql_concurrent_idempotency_and_fenced_resume(sql_environment):
    import asyncio
    from app.errors import AppError
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=sql_environment
    replacement=SupabaseAdapter(app.state.settings,storage=adapter.storage)
    try:
        case,payload=await prepare_adapter(sql_environment)
        submissions=await asyncio.gather(adapter.create_job(buyer,case.id,"concurrent",payload),
            adapter.create_job(buyer,case.id,"concurrent",payload))
        assert submissions[0][0].id==submissions[1][0].id and sum(int(item[1]) for item in submissions)==1
        job=submissions[0][0]
        assert await adapter.claim_job(buyer,job.id)
        assert not await replacement.claim_job(buyer,job.id)
        with psycopg.connect(TEST_URL) as connection:
            connection.execute("UPDATE public.investigation_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=%s",(job.id,))
        assert await replacement.claim_job(buyer,job.id)
        worker=await replacement.get_job(buyer,job.id)
        with pytest.raises(AppError) as error:
            await adapter.update_job(buyer,worker)
        assert error.value.code=="LEASE_LOST"
        worker.status="FAILED"
        worker.error_code="SYNTHETIC_TEST_END"
        await replacement.update_job(buyer,worker)
    finally:
        await adapter.close()
        await replacement.close()


async def test_real_sql_revoked_and_ambiguous_memberships(sql_environment):
    from app.errors import AppError
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=sql_environment
    try:
        with psycopg.connect(TEST_URL) as connection:
            connection.execute("UPDATE public.organization_members SET is_active=false WHERE user_id=%s",(buyer,))
        with pytest.raises(AppError) as error:
            await adapter.list_cases(buyer)
        assert error.value.code=="MEMBERSHIP_REQUIRED"
        with psycopg.connect(TEST_URL) as connection:
            other_org=connection.execute("SELECT org_id FROM public.organization_members WHERE user_id=%s",(outsider,)).fetchone()[0]
            connection.execute("INSERT INTO public.organization_members(org_id,user_id,role) VALUES (%s,%s,'buyer')",(other_org,reviewer))
        with pytest.raises(AppError) as error:
            await adapter.list_cases(reviewer)
        assert error.value.code=="AMBIGUOUS_MEMBERSHIP"
    finally:
        await adapter.close()


def test_real_sql_storage_rls_requires_case_and_reservation(sql_environment):
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=sql_environment
    with TestClient(app) as client:
        case_id,payload=prepare_case(client,sql_environment)
        reservation=client.post(f"/api/v1/cases/{case_id}/documents/upload-intents",json={
            "filename":"pending.pdf","document_type":"RFQ","size_bytes":100})
        assert reservation.status_code==201,reservation.text
        pending_key=f"{org}/{case_id}/{reservation.json()['document_id']}.pdf"
        with psycopg.connect(TEST_URL) as connection:
            connection.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(str(buyer),))
            canonical=f"{org}/{case_id}/{payload['baseline_document_id']}.pdf"
            assert connection.execute("SELECT public.can_access_case_document_object(%s,false)",(canonical,)).fetchone()[0] is True
            assert connection.execute("SELECT public.can_access_case_document_object(%s,true)",(pending_key,)).fetchone()[0] is True
            assert connection.execute("SELECT public.can_access_case_document_object(%s,true)",(canonical,)).fetchone()[0] is False
            unknown=f"{org}/{uuid4()}/{uuid4()}.pdf"
            assert connection.execute("SELECT public.can_access_case_document_object(%s,true)",(unknown,)).fetchone()[0] is False
            connection.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(str(outsider),))
            assert connection.execute("SELECT public.can_access_case_document_object(%s,false)",(canonical,)).fetchone()[0] is False
            # Exercise the actual INSERT policy, not only the helper function. Grants
            # mirror Supabase's Storage schema in the isolated local stand-in and roll back.
            connection.execute("GRANT USAGE ON SCHEMA storage TO authenticated")
            connection.execute("GRANT INSERT,SELECT ON storage.objects TO authenticated")
            connection.execute("SELECT set_config('request.jwt.claim.sub',%s,true)",(str(buyer),))
            connection.execute("SET LOCAL ROLE authenticated")
            connection.execute("INSERT INTO storage.objects(id,bucket_id,name) VALUES (%s,'case-documents',%s)",(uuid4(),pending_key))
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                with connection.transaction():
                    connection.execute("INSERT INTO storage.objects(id,bucket_id,name) VALUES (%s,'case-documents',%s)",(uuid4(),unknown))
            connection.rollback()


def test_real_sql_rounds_each_advance_before_subtracting():
    with psycopg.connect(TEST_URL) as connection:
        baseline,final,difference,increased=connection.execute(
            "SELECT * FROM public.calculate_advance_exposure(1.01,50,1.02,50)").fetchone()
        assert baseline==final and difference==0 and increased is False


def test_real_sql_document_currency_is_not_relabelled_as_case_default(sql_environment):
    app,adapter,identity,objects,requests,org,buyer,reviewer,outsider=sql_environment
    with TestClient(app) as client:
        case_id,payload=prepare_case(client,sql_environment,currency="USD")
        started=client.post(f"/api/v1/cases/{case_id}/investigations",json=payload,headers={"Idempotency-Key":"usd-version"})
        assert client.get(started.json()["poll_url"]).json()["status"]=="REVIEW_READY"
        result=client.get(f"/api/v1/cases/{case_id}/findings").json()
        assert result["advance_exposure"]["currency"]=="USD"
        with psycopg.connect(TEST_URL) as connection:
            assert connection.execute("SELECT currency FROM public.purchase_cases WHERE id=%s",(case_id,)).fetchone()[0]=="INR"
            assert {row[0] for row in connection.execute("SELECT currency FROM public.deal_versions WHERE investigation_job_id=%s",
                (started.json()["job_id"],)).fetchall()}=={"USD"}
