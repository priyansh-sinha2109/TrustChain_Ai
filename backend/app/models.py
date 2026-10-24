from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentType(StrEnum):
    RFQ = "RFQ"
    ACCEPTED_QUOTE = "ACCEPTED_QUOTE"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    FINAL_PI = "FINAL_PI"


class User(BaseModel):
    id: UUID


class CaseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    supplier_name: str = Field(min_length=1, max_length=200)
    public_supplier_url: str | None = Field(default=None, max_length=2048)


class Case(CaseCreate):
    id: UUID
    supplier_id: UUID


class Document(BaseModel):
    id: UUID
    case_id: UUID
    document_type: DocumentType
    approved: bool = False
    content_type: str = "application/pdf"
    size_bytes: int = Field(ge=1, le=10_000_000)


class UploadIntent(BaseModel):
    filename: str = Field(min_length=1, max_length=200, pattern=r"^[\w .-]+\.pdf$")
    document_type: DocumentType
    size_bytes: int = Field(ge=1, le=10_000_000)


class UploadConfirm(BaseModel):
    document_id: UUID


class UploadTarget(BaseModel):
    document_id: UUID
    upload_url: str
    expires_at: datetime


class SourceField(BaseModel):
    document_id: UUID
    document_type: DocumentType
    field_key: str
    value: str
    unit: str | None = None
    line_item: str | None = None
    page_number: int = Field(ge=1)
    raw_text: str


class Finding(BaseModel):
    field_key: str
    category: Literal["TECHNICAL", "COMMERCIAL", "PUBLIC"]
    status: Literal["MATCH", "CONFLICT", "MISSING", "AMBIGUOUS", "NOT_CHECKED", "INSUFFICIENT_EVIDENCE"]
    severity: Literal["INFO", "WARNING", "HIGH"]
    baseline: list[SourceField] = Field(default_factory=list)
    final: list[SourceField] = Field(default_factory=list)
    explanation: str
    suggested_action: str = "Review the source evidence before purchasing approval."


class Exposure(BaseModel):
    status: Literal["CALCULATED", "INSUFFICIENT_EVIDENCE", "CURRENCY_MISMATCH", "AMBIGUOUS"]
    currency: str | None = None
    baseline_amount: Decimal | None = None
    final_amount: Decimal | None = None
    difference: Decimal | None = None


class InvestigationStart(BaseModel):
    baseline_document_id: UUID
    final_document_id: UUID
    public_research: bool = True


class Job(BaseModel):
    id: UUID
    case_id: UUID
    status: Literal["QUEUED", "PROCESSING", "REVIEW_READY", "PARTIAL_REVIEW", "FAILED", "REVIEWED"]
    stage: str
    request: InvestigationStart
    provider_run_id: str | None = None
    error_code: str | None = None


class JobAccepted(BaseModel):
    job_id: UUID
    status: str
    poll_url: str


class Evidence(BaseModel):
    provider_run_id: str
    source_url: str
    observation: str
    captured_at: datetime
    provider_finished_at: str | None = None


class FindingsResponse(BaseModel):
    case_id: UUID
    job_id: UUID
    supplier_id: UUID
    baseline_document_id: UUID
    final_document_id: UUID
    created_at: datetime
    investigation_status: str
    findings: list[Finding]
    extracted_fields: list[SourceField] = Field(default_factory=list)
    advance_exposure: Exposure
    evidence: list[Evidence] = Field(default_factory=list)


class Review(BaseModel):
    job_id: UUID
    decision: Literal["APPROVE", "REQUEST_CLARIFICATION", "REJECT"]
    comment: str = Field(min_length=1, max_length=2000)
