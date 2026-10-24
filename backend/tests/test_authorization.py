from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.mark.parametrize("status,expected", [(401, 401), (403, 401), (500, 503)])
def test_supabase_verification_errors(monkeypatch, status, expected):
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(status, json={"message": "private-provider-error"}))
    monkeypatch.setattr("app.security.httpx", SimpleNamespace(AsyncClient=lambda **kw:
        client_type(**kw, transport=transport), HTTPError=httpx.HTTPError))
    app = create_app(Settings(supabase_url="https://project.supabase.co", supabase_anon_key="test-key", _env_file=None))
    with TestClient(app) as client:
        result = client.get("/api/v1/me", headers={"Authorization": "Bearer test-private-token"})
    assert result.status_code == expected
    assert "test-private-token" not in result.text and "private-provider-error" not in result.text


def test_verified_identity_from_supabase(monkeypatch):
    from uuid import uuid4
    user_id = str(uuid4())
    client_type = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"id": user_id}))
    monkeypatch.setattr("app.security.httpx", SimpleNamespace(AsyncClient=lambda **kw:
        client_type(**kw, transport=transport), HTTPError=httpx.HTTPError))
    app = create_app(Settings(supabase_url="https://project.supabase.co", supabase_anon_key="test-key", _env_file=None))
    with TestClient(app) as client:
        assert client.get("/api/v1/me", headers={"Authorization": "Bearer token"}).json() == {"id": user_id}
