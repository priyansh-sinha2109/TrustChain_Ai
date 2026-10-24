"""
TrustChain AI — Supabase Private Document Storage Manager
Role: Member 3 (Supabase Architecture, Data Persistence, Security & Audit)

Manages private document storage in Supabase Storage with strict:
1. Path isolation: {org_id}/{case_id}/{document_uuid}.pdf
2. Filename sanitization and random UUID object naming (preventing directory traversal)
3. Restricted MIME validation (application/pdf)
4. Expiring signed upload/download URLs
5. SHA256 integrity hashing
"""

import hashlib
import os
import re
from typing import Any, Dict, Optional, Tuple
import uuid
from urllib.parse import urlsplit, parse_qs

import httpx


class StorageError(RuntimeError):
    def __init__(self, code, message, status=503):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


class StorageService:
    DEFAULT_DOCUMENTS_BUCKET = "case-documents"
    DEFAULT_REPORTS_BUCKET = "case-reports"
    MAX_FILE_SIZE_BYTES = 10_000_000
    ALLOWED_MIME_TYPES = {"application/pdf"}

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        documents_bucket: Optional[str] = None,
        reports_bucket: Optional[str] = None,
        transport=None,
    ):
        self.supabase_url = (supabase_url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.service_role_key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.documents_bucket = documents_bucket or os.getenv("STORAGE_BUCKET_DOCUMENTS", self.DEFAULT_DOCUMENTS_BUCKET)
        self.reports_bucket = reports_bucket or os.getenv("STORAGE_BUCKET_REPORTS", self.DEFAULT_REPORTS_BUCKET)
        self.transport = transport

    @staticmethod
    def generate_storage_key(org_id: uuid.UUID, case_id: uuid.UUID, doc_id: Optional[uuid.UUID] = None) -> str:
        """
        Generates a canonical, secure storage path: {org_id}/{case_id}/{doc_id}.pdf
        Guarantees that user-supplied filenames never control object paths.
        """
        target_doc_id = doc_id or uuid.uuid4()
        return f"{org_id}/{case_id}/{target_doc_id}.pdf"

    @staticmethod
    def validate_storage_key(storage_key: str, expected_org_id: uuid.UUID, expected_case_id: Optional[uuid.UUID] = None) -> bool:
        """
        Validates that a storage key conforms to {org_id}/{case_id}/{doc_id}.pdf
        and belongs strictly to the authenticated tenant organization.
        """
        if not storage_key or ".." in storage_key or "//" in storage_key:
            return False

        pattern = r"^([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})/([0-9a-fA-F-]{36})\.pdf$"
        match = re.match(pattern, storage_key)
        if not match:
            return False

        try:
            key_org_id = uuid.UUID(match.group(1))
            key_case_id = uuid.UUID(match.group(2))
            uuid.UUID(match.group(3))
        except ValueError:
            return False

        if key_org_id != expected_org_id:
            return False

        if expected_case_id is not None and key_case_id != expected_case_id:
            return False

        return True

    @staticmethod
    def validate_file_metadata(file_name: str, mime_type: str, file_size: int) -> Tuple[bool, Optional[str]]:
        """Validates file properties before issuing upload tickets."""
        if not file_name or len(file_name.strip()) == 0:
            return False, "File name cannot be empty."

        clean_mime = mime_type.lower().strip()
        if clean_mime not in StorageService.ALLOWED_MIME_TYPES:
            return False, f"Unsupported MIME type: '{mime_type}'. Only PDF documents are permitted."

        if not file_name.lower().endswith(".pdf"):
            return False, "File must have a .pdf extension."

        if file_size <= 0:
            return False, "File size must be greater than 0 bytes."

        if file_size > StorageService.MAX_FILE_SIZE_BYTES:
            max_mb = StorageService.MAX_FILE_SIZE_BYTES / (1024 * 1024)
            return False, f"File exceeds maximum allowed size of {max_mb:.0f} MB."

        return True, None

    @staticmethod
    def compute_sha256(data: bytes) -> str:
        """Computes SHA256 hex digest for file content verification."""
        return hashlib.sha256(data).hexdigest()

    def create_signed_upload_instruction(
        self,
        org_id: uuid.UUID,
        case_id: uuid.UUID,
        file_name: str,
        file_size: int,
        mime_type: str = "application/pdf",
        doc_id: Optional[uuid.UUID] = None,
        expires_in_seconds: int = 7200,
    ) -> Dict[str, Any]:
        """
        Generates a restricted, short-lived upload instruction for the frontend.
        Browser uploads directly to private Supabase Storage using this signed ticket.
        """
        is_valid, error_msg = self.validate_file_metadata(file_name, mime_type, file_size)
        if not is_valid:
            raise ValueError(error_msg)
        if expires_in_seconds != 7200:
            raise ValueError("Supabase signed uploads have a fixed two-hour lifetime.")

        target_doc_id = doc_id or uuid.uuid4()
        storage_key = self.generate_storage_key(org_id, case_id, target_doc_id)

        data = self._sign(f"/object/upload/sign/{self.documents_bucket}/{storage_key}", {})
        upload_url = self._signed_url(data.get("url"), f"/object/upload/sign/{self.documents_bucket}/{storage_key}")

        return {
            "document_id": str(target_doc_id),
            "storage_key": storage_key,
            "bucket": self.documents_bucket,
            "upload_url": upload_url,
            # Supabase upload signatures have a provider-defined two-hour lifetime.
            "expires_in_seconds": 7200,
            "required_headers": {
                "Content-Type": "application/pdf",
            },
        }

    def create_signed_download_url(
        self,
        storage_key: str,
        org_id: uuid.UUID,
        expires_in_seconds: int = 3600,
        bucket: Optional[str] = None,
    ) -> str:
        """
        Generates a short-lived expiring download URL for a verified private document.
        Guarantees that the document belongs to the requesting organization.
        """
        if not self.validate_storage_key(storage_key, expected_org_id=org_id):
            raise PermissionError("Cross-tenant storage access denied. Object does not belong to organization.")

        target_bucket = bucket or self.documents_bucket
        if target_bucket != self.documents_bucket:
            raise ValueError("Only case document signing is supported by this integration.")
        if not 1 <= expires_in_seconds <= 3600:
            raise ValueError("Download expiry must be between 1 and 3600 seconds.")
        path = f"/object/sign/{target_bucket}/{storage_key}"
        data = self._sign(path, {"expiresIn": expires_in_seconds})
        return self._signed_url(data.get("signedURL"), path)

    def _client(self):
        if not self.supabase_url or not self.service_role_key:
            raise StorageError("STORAGE_UNCONFIGURED", "Private Storage is not configured.")
        return httpx.Client(timeout=20, follow_redirects=False, transport=self.transport)

    def _sign(self, path, payload):
        try:
            with self._client() as client:
                response = client.post(self.supabase_url + "/storage/v1" + path,
                    json=payload, headers={"apikey": self.service_role_key,
                        "Authorization": f"Bearer {self.service_role_key}", "x-upsert": "false"})
            if response.status_code == 404:
                raise StorageError("OBJECT_NOT_FOUND", "Private object or bucket is missing.", 404)
            if response.status_code >= 300:
                raise StorageError("STORAGE_SIGNING_FAILED", "Private Storage signing failed.")
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError
            return data
        except (httpx.HTTPError, ValueError):
            raise StorageError("STORAGE_UNAVAILABLE", "Private Storage returned no usable response.") from None

    def _signed_url(self, value, expected_path):
        if not isinstance(value, str):
            raise StorageError("STORAGE_INVALID_SIGNATURE", "Storage did not return a signed URL.")
        url = value if value.startswith("https://") else self.supabase_url + "/storage/v1" + value
        parsed, base = urlsplit(url), urlsplit(self.supabase_url)
        if (parsed.scheme != "https" or parsed.netloc != base.netloc
                or parsed.path != base.path.rstrip("/") + "/storage/v1" + expected_path
                or not parse_qs(parsed.query).get("token") or parsed.fragment):
            raise StorageError("STORAGE_INVALID_SIGNATURE", "Storage returned an invalid signed URL.")
        return url

    def download_document(self, storage_key, org_id, case_id):
        if not self.validate_storage_key(storage_key, org_id, case_id):
            raise PermissionError("Object association is invalid.")
        url = self.create_signed_download_url(storage_key, org_id, expires_in_seconds=60)
        try:
            with self._client() as client:
                # The signed URL is the credential: never forward the service key to a redirect.
                with client.stream("GET", url) as response:
                    if response.status_code == 404:
                        raise StorageError("OBJECT_NOT_FOUND", "The uploaded private object does not exist.", 404)
                    if response.status_code >= 300:
                        raise StorageError("STORAGE_DOWNLOAD_FAILED", "Private object could not be downloaded.")
                    if response.headers.get("content-type", "").split(";")[0].strip() != "application/pdf":
                        raise StorageError("UNSUPPORTED_DOCUMENT", "Private object must have PDF content type.", 422)
                    content = bytearray()
                    for chunk in response.iter_bytes(64 * 1024):
                        content.extend(chunk)
                        if len(content) > self.MAX_FILE_SIZE_BYTES:
                            raise StorageError("INVALID_DOCUMENT_SIZE", "Private PDF exceeds the 10 MB limit.", 422)
            if not content.startswith(b"%PDF-"):
                raise StorageError("UNSUPPORTED_DOCUMENT", "Private object is not a PDF.", 422)
            return bytes(content)
        except httpx.HTTPError:
            raise StorageError("STORAGE_UNAVAILABLE", "Private object retrieval is unavailable.") from None
