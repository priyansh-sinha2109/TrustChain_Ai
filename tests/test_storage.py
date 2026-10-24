"""
Tests for Supabase Storage Service and Path Validation
Verifies path format {org_id}/{case_id}/{doc_id}.pdf, directory traversal protection, and file constraints.
"""

import uuid
import pytest
from trustchain.database.storage import StorageService


def test_storage_key_generation():
    org_id = uuid.uuid4()
    case_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    key = StorageService.generate_storage_key(org_id, case_id, doc_id)
    assert key == f"{org_id}/{case_id}/{doc_id}.pdf"
    assert StorageService.validate_storage_key(key, expected_org_id=org_id, expected_case_id=case_id)


def test_directory_traversal_rejection():
    org_id = uuid.uuid4()
    case_id = uuid.uuid4()

    malicious_keys = [
        f"../../{org_id}/{case_id}/secret.pdf",
        f"{org_id}/../other_org/doc.pdf",
        f"{org_id}//{case_id}/doc.pdf",
        f"{org_id}/{case_id}/payload.exe",
    ]

    for key in malicious_keys:
        assert not StorageService.validate_storage_key(key, expected_org_id=org_id)


def test_cross_tenant_storage_key_mismatch():
    org_a = uuid.uuid4()
    org_b = uuid.uuid4()
    case_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    key_org_a = StorageService.generate_storage_key(org_a, case_id, doc_id)

    # Attempt to validate using Org B credentials must fail
    assert not StorageService.validate_storage_key(key_org_a, expected_org_id=org_b)


def test_file_metadata_validation():
    # Valid PDF
    valid, err = StorageService.validate_file_metadata("quote.pdf", "application/pdf", 1024 * 500)
    assert valid is True
    assert err is None

    # Invalid MIME type
    valid, err = StorageService.validate_file_metadata("script.js", "application/javascript", 1024)
    assert valid is False
    assert "Unsupported MIME type" in err

    # Invalid extension
    valid, err = StorageService.validate_file_metadata("document.docx", "application/pdf", 1024)
    assert valid is False
    assert "must have a .pdf extension" in err

    # Exceeding 15 MB limit
    oversized = (15 * 1024 * 1024) + 1
    valid, err = StorageService.validate_file_metadata("huge.pdf", "application/pdf", oversized)
    assert valid is False
    assert "exceeds maximum allowed size" in err


def test_sha256_computation():
    content = b"%PDF-1.4 sample content for hash test"
    h = StorageService.compute_sha256(content)
    assert len(h) == 64
    assert h == StorageService.compute_sha256(content)
