from uuid import uuid4

import httpx
import pytest

from trustchain.database.storage import StorageError, StorageService


def test_real_signing_wire_contracts_and_private_download():
    org, case, doc = uuid4(), uuid4(), uuid4()
    key = StorageService.generate_storage_key(org, case, doc)
    calls = []
    def handler(request):
        calls.append(request)
        path = request.url.path.removeprefix("/storage/v1")
        if request.method == "POST":
            if "/upload/" in path:
                return httpx.Response(200, json={"url": path + "?token=synthetic-signature"})
            return httpx.Response(200, json={"signedURL": path + "?token=synthetic-signature"})
        return httpx.Response(200, content=b"%PDF-synthetic", headers={"Content-Type": "application/pdf"})
    service = StorageService("https://test.supabase.co", "private-test-key", transport=httpx.MockTransport(handler))
    ticket = service.create_signed_upload_instruction(org, case, "quote.pdf", 14, doc_id=doc)
    assert "token=synthetic-signature" in ticket["upload_url"] and ticket["expires_in_seconds"] == 7200
    assert service.download_document(key, org, case) == b"%PDF-synthetic"
    assert calls[0].headers["Authorization"] == "Bearer private-test-key"
    assert "authorization" not in calls[-1].headers


@pytest.mark.parametrize("response", [{}, {"url": "/object/upload/sign/evil?token=x"},
    {"url": "https://evil.test/steal?token=x"}])
def test_missing_or_wrong_signature_rejected(response):
    service = StorageService("https://test.supabase.co", "test", transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json=response)))
    with pytest.raises(StorageError):
        service.create_signed_upload_instruction(uuid4(), uuid4(), "quote.pdf", 10)


@pytest.mark.parametrize("status,content_type,content", [(404,"application/pdf",b""),
    (302,"application/pdf",b""),(200,"text/html",b"%PDF-"),(200,"application/pdf",b"html")])
def test_missing_redirect_wrong_mime_and_non_pdf_rejected(status,content_type,content):
    org, case = uuid4(), uuid4()
    key = StorageService.generate_storage_key(org, case)
    def handler(request):
        if request.method == "POST":
            return httpx.Response(200,json={"signedURL": f"/object/sign/case-documents/{key}?token=test"})
        return httpx.Response(status,content=content,headers={"Content-Type": content_type})
    service = StorageService("https://test.supabase.co", "test", transport=httpx.MockTransport(handler))
    with pytest.raises(StorageError):
        service.download_document(key, org, case)


def test_unconfigured_signing_and_stricter_limit():
    service = StorageService("", "")
    with pytest.raises(StorageError):
        service.create_signed_upload_instruction(uuid4(),uuid4(),"q.pdf",10)
    assert not service.validate_file_metadata("q.pdf","application/pdf",10_000_001)[0]
