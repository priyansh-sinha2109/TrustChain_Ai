"""Onboarding transactions on isolated local PostgreSQL; Auth HTTP remains mocked."""
import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.models import WorkspaceCreate
from test_sql_integration import sql_environment, TEST_URL

pytestmark = pytest.mark.skipif(not TEST_URL, reason="Isolated PostgreSQL not configured")


def account(user_id, confirmed=True):
    with psycopg.connect(TEST_URL) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz)")
        connection.execute("INSERT INTO auth.users(id,email_confirmed_at) VALUES (%s,%s)",
            (user_id, datetime.now(timezone.utc) if confirmed else None))


def test_confirmed_user_creates_buyer_workspace_once(sql_environment):
    app, adapter, identity, *_ = sql_environment
    identity["id"] = uuid4()
    account(identity["id"])
    with TestClient(app) as client:
        assert client.get("/api/v1/membership").status_code == 403
        first = client.post("/api/v1/onboarding/workspace", json={"organization_name": "New isolated workspace"})
        assert first.status_code == 200 and first.json()["role"] == "buyer"
        second = client.post("/api/v1/onboarding/workspace", json={"organization_name": "Ignored retry name"})
        assert second.json() == first.json()
        assert client.get("/api/v1/membership").json() == first.json()
        with psycopg.connect(TEST_URL) as connection:
            assert connection.execute("SELECT count(*) FROM public.organization_members WHERE user_id=%s", (identity["id"],)).fetchone()[0] == 1
            assert connection.execute("SELECT count(*) FROM public.audit_events WHERE actor_id=%s AND action='workspace.created'", (identity["id"],)).fetchone()[0] == 1


def test_unconfirmed_user_cannot_provision(sql_environment):
    app, adapter, identity, *_ = sql_environment
    identity["id"] = uuid4(); account(identity["id"], False)
    with TestClient(app) as client:
        response = client.post("/api/v1/onboarding/workspace", json={"organization_name": "Unconfirmed"})
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "EMAIL_CONFIRMATION_REQUIRED"


def test_onboarding_cannot_assign_role_or_join_tenant(sql_environment):
    app, adapter, identity, *_ = sql_environment
    identity["id"] = uuid4(); account(identity["id"])
    with TestClient(app) as client:
        assert client.post("/api/v1/onboarding/workspace", json={"organization_name": "Existing tenant", "role": "admin", "org_id": str(uuid4())}).status_code == 422
        assert client.post("/api/v1/onboarding/workspace", json={"organization_name": "  "}).status_code == 422


def test_revoked_membership_cannot_be_bypassed_by_onboarding(sql_environment):
    app, adapter, identity, _, _, org, buyer, *_ = sql_environment
    account(buyer)
    with psycopg.connect(TEST_URL) as connection:
        connection.execute("UPDATE public.organization_members SET is_active=false WHERE user_id=%s", (buyer,))
    with TestClient(app) as client:
        response = client.post("/api/v1/onboarding/workspace", json={"organization_name": "Bypass attempt"})
        assert response.status_code == 403 and response.json()["error"]["code"] == "MEMBERSHIP_INACTIVE"


def test_existing_reviewer_keeps_role_and_tenant(sql_environment):
    app, adapter, identity, _, _, org, buyer, reviewer, *_ = sql_environment
    identity["id"] = reviewer; account(reviewer)
    with TestClient(app) as client:
        response = client.post("/api/v1/onboarding/workspace", json={"organization_name": "Ignored"})
        assert response.json()["role"] == "reviewer" and response.json()["org_id"] == str(org)


async def test_concurrent_onboarding_is_atomic(sql_environment):
    _, adapter, identity, *_ = sql_environment
    user_id = uuid4(); account(user_id)
    try:
        results = await asyncio.gather(*(adapter.create_workspace(user_id, WorkspaceCreate(organization_name="Concurrent synthetic workspace")) for _ in range(3)))
        assert len({result.org_id for result in results}) == 1
    finally:
        await adapter.close()
