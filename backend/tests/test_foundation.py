from fastapi.testclient import TestClient
from app.main import create_app
from app.config import Settings


def test_health_and_docs():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get("/health")
        assert response.json() == {"status": "ok", "service": "trustchain-backend"}
        assert response.headers["X-Request-ID"]
        assert client.get("/openapi.json").status_code == 200
        assert client.get("/api/v1/me").status_code == 401
        assert client.get("/api/v1/me", headers={"Authorization": "Bearer invalid"}).status_code == 503


def test_production_hides_docs():
    with TestClient(create_app(Settings(environment="production", _env_file=None))) as client:
        assert client.get("/openapi.json").status_code == 404
