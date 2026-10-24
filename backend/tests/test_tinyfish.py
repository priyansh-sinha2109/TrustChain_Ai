import socket
from unittest.mock import AsyncMock

import httpx
import pytest

from app.config import Settings
from app.errors import AppError
from app.tinyfish import TinyFish, validate_public_url


@pytest.fixture(autouse=True)
def public_dns(monkeypatch):
    monkeypatch.setattr("asyncio.BaseEventLoop.getaddrinfo", AsyncMock(return_value=[
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.215.14", 443))]))


@pytest.mark.parametrize("url", ["http://example.com", "https://localhost", "https://127.0.0.1",
    "https://169.254.169.254", "file:///etc/passwd", "https://example.com?token=secret",
    "https://user:pass@example.com", "https://example.com:8080", "https://evil.example.com"])
async def test_blocks_unsafe_urls(url):
    with pytest.raises(AppError):
        await validate_public_url(url, {"example.com"})


async def test_private_dns_blocked(monkeypatch):
    monkeypatch.setattr("asyncio.BaseEventLoop.getaddrinfo", AsyncMock(return_value=[
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 443))]))
    with pytest.raises(AppError):
        await validate_public_url("https://example.com", {"example.com"})


async def test_actual_wire_contract_and_result():
    calls = []
    def handle(request):
        calls.append(request)
        if request.method == "POST":
            return httpx.Response(200, json={"run_id": "run-test"})
        return httpx.Response(200, json={"run_id": "run-test", "status": "COMPLETED",
            "result": {"observations": [{"source_url": "https://example.com", "observation": "Example Domain"}]}})
    adapter = TinyFish(Settings(tinyfish_api_key="test-secret", _env_file=None), httpx.MockTransport(handle))
    run_id = await adapter.start_public_research("https://example.com")
    result = await adapter.get_research_run(run_id)
    assert len(await adapter.normalize_public_result(result, "https://example.com")) == 1
    assert calls[0].url.path == "/v1/automation/run-async"
    assert calls[0].headers["X-API-Key"] == "test-secret"
    assert calls[1].url.path == "/v1/runs/run-test"


@pytest.mark.parametrize("status,code", [(401, "PROVIDER_AUTH"), (402, "PROVIDER_QUOTA"),
    (429, "PROVIDER_RATE_LIMIT"), (500, "PROVIDER_UNAVAILABLE")])
async def test_provider_errors(status, code):
    adapter = TinyFish(Settings(tinyfish_api_key="test", _env_file=None),
        httpx.MockTransport(lambda r: httpx.Response(status, text="sensitive provider text")))
    with pytest.raises(AppError) as error:
        await adapter.start_public_research("https://example.com")
    assert error.value.code == code
    assert "sensitive" not in error.value.message


async def test_empty_and_unsourced_result():
    adapter = TinyFish(Settings(_env_file=None))
    assert await adapter.normalize_public_result({"status": "COMPLETED", "result": {
        "observations": [{"source_url": "https://evil.test", "observation": "claim"}]}},
        "https://example.com") == []
