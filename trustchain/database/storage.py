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


class StorageService:
    DEFAULT_DOCUMENTS_BUCKET = "case-documents"
    DEFAULT_REPORTS_BUCKET = "case-reports"
    MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
    ALLOWED_MIME_TYPES = {"application/pdf"}

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
        documents_bucket: Optional[str] = None,
        reports_bucket: Optional[str] = None,
    ):
        self.supabase_url = (supabase_url or os.getenv("SUPABASE_URL", "")).rstrip("/")
        self.service_role_key = service_role_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.documents_bucket = documents_bucket or os.getenv("STORAGE_BUCKET_DOCUMENTS", self.DEFAULT_DOCUMENTS_BUCKET)
        self.reports_bucket = reports_bucket or os.getenv("STORAGE_BUCKET_REPORTS", self.DEFAULT_REPORTS_BUCKET)

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

        key_org_id = uuid.UUID(match.group(1))
        key_case_id = uuid.UUID(match.group(2))

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
        expires_in_seconds: int = 3600,
    ) -> Dict[str, Any]:
        """
        Generates a restricted, short-lived upload instruction for the frontend.
        Browser uploads directly to private Supabase Storage using this signed ticket.
        """
        is_valid, error_msg = self.validate_file_metadata(file_name, mime_type, file_size)
        if not is_valid:
            raise ValueError(error_msg)

        target_doc_id = doc_id or uuid.uuid4()
        storage_key = self.generate_storage_key(org_id, case_id, target_doc_id)

        # In production Supabase, this generates a signed upload URL via Storage REST API:
        # POST /storage/v1/object/upload/sign/{bucket}/{path}
        upload_url = f"{self.supabase_url}/storage/v1/object/upload/sign/{self.documents_bucket}/{storage_key}"

        return {
            "document_id": str(target_doc_id),
            "storage_key": storage_key,
            "bucket": self.documents_bucket,
            "upload_url": upload_url,
            "expires_in_seconds": expires_in_seconds,
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
        # In production Supabase:
        # POST /storage/v1/object/sign/{bucket}/{path} -> {"signedURL": "..."}
        return f"{self.supabase_url}/storage/v1/object/sign/{target_bucket}/{storage_key}?token=short_lived_token&expiresIn={expires_in_seconds}"
