"""
TrustChain AI — Data Models & Schemas
Role: Member 3 (Supabase Architecture, Data Persistence, Security & Audit)

Defines strongly-typed data structures for the procurement evidence layer.
Financial amounts strictly use Python's `Decimal` to avoid floating point errors.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid


class RoleEnum(str, Enum):
    BUYER = "buyer"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class CaseStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    DOCS_UPLOADED = "DOCS_UPLOADED"
    RESEARCHING = "RESEARCHING"
    ANALYZED = "ANALYZED"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FLAGGED = "FLAGGED"


class DocTypeEnum(str, Enum):
    RFQ = "RFQ"
    ACCEPTED_QUOTE = "ACCEPTED_QUOTE"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    FINAL_PI = "FINAL_PI"
    OTHER = "OTHER"


class DocStatusEnum(str, Enum):
    PENDING = "PENDING"
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    EXTRACTED = "EXTRACTED"
    ERROR = "ERROR"


class DealStageEnum(str, Enum):
    RFQ = "RFQ"
    ACCEPTED_QUOTE = "ACCEPTED_QUOTE"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    FINAL_PI = "FINAL_PI"


class ResearchStatusEnum(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class EvidenceKindEnum(str, Enum):
    PUBLIC_WEB = "PUBLIC_WEB"
    PRIVATE_PDF = "PRIVATE_PDF"


class VerificationStatusEnum(str, Enum):
    OBSERVED = "OBSERVED"
    VERIFIED_MATCH = "VERIFIED_MATCH"
    DISCREPANCY = "DISCREPANCY"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


class SeverityEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ChangeCategoryEnum(str, Enum):
    TECHNICAL = "TECHNICAL"
    COMMERCIAL = "COMMERCIAL"


class ChangeStatusEnum(str, Enum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    REJECTED = "REJECTED"


class ReviewActionEnum(str, Enum):
    ACKNOWLEDGED = "ACKNOWLEDGED"
    REQUEST_INFO = "REQUEST_INFO"
    NEEDS_ENGINEER = "NEEDS_ENGINEER"


class DecisionEnum(str, Enum):
    APPROVE_ADVANCE = "APPROVE_ADVANCE"
    REJECT_PAYMENT = "REJECT_PAYMENT"
    REQUEST_SUPPLIER_CLARIFICATION = "REQUEST_SUPPLIER_CLARIFICATION"
    ESCALATE_TO_MANAGEMENT = "ESCALATE_TO_MANAGEMENT"


def default_now() -> datetime:
    return datetime.now(timezone.utc)


def to_decimal(val: Any) -> Decimal:
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    return Decimal(str(val))


@dataclass
class Organization:
    id: uuid.UUID
    name: str
    slug: str
    created_at: datetime = field(default_factory=default_now)
    updated_at: datetime = field(default_factory=default_now)


@dataclass
class OrganizationMember:
    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    role: RoleEnum
    joined_at: datetime = field(default_factory=default_now)


@dataclass
class Supplier:
    id: uuid.UUID
    org_id: uuid.UUID
    legal_name: str
    trade_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    website_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    created_at: datetime = field(default_factory=default_now)
    updated_at: datetime = field(default_factory=default_now)


@dataclass
class PurchaseCase:
    id: uuid.UUID
    org_id: uuid.UUID
    case_number: str
    title: str
    status: CaseStatusEnum = CaseStatusEnum.DRAFT
    currency: str = "INR"
    target_item: Optional[str] = None
    target_quantity: Optional[Decimal] = None
    created_by: uuid.UUID = field(default_factory=uuid.uuid4)
    created_at: datetime = field(default_factory=default_now)
    updated_at: datetime = field(default_factory=default_now)


@dataclass
class CaseSupplier:
    id: uuid.UUID
    case_id: uuid.UUID
    supplier_id: uuid.UUID
    is_primary: bool = True
    created_at: datetime = field(default_factory=default_now)


@dataclass
class Document:
    id: uuid.UUID
    case_id: uuid.UUID
    storage_key: str
    file_name: str
    file_size: int
    doc_type: DocTypeEnum = DocTypeEnum.OTHER
    supplier_id: Optional[uuid.UUID] = None
    mime_type: str = "application/pdf"
    sha256: Optional[str] = None
    status: DocStatusEnum = DocStatusEnum.PENDING
    created_at: datetime = field(default_factory=default_now)


@dataclass
class DealVersion:
    id: uuid.UUID
    case_id: uuid.UUID
    stage: DealStageEnum
    total_amount: Decimal
    advance_percentage: Decimal
    supplier_id: Optional[uuid.UUID] = None
    document_id: Optional[uuid.UUID] = None
    version_no: int = 1
    delivery_timeline_days: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=default_now)

    @property
    def advance_amount(self) -> Decimal:
        """Calculates exact advance commitment: (total_amount * advance_percentage) / 100."""
        return ((self.total_amount * self.advance_percentage) / Decimal("100.0")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )


@dataclass
class PublicResearchRun:
    id: uuid.UUID
    case_id: uuid.UUID
    tinyfish_run_id: str
    target_url: str
    status: ResearchStatusEnum
    case_supplier_id: Optional[uuid.UUID] = None
    started_at: datetime = field(default_factory=default_now)
    completed_at: Optional[datetime] = None
    error_code: Optional[str] = None
    raw_result: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=default_now)


@dataclass
class EvidenceSource:
    id: uuid.UUID
    case_id: uuid.UUID
    kind: EvidenceKindEnum
    source_url: Optional[str] = None
    document_id: Optional[uuid.UUID] = None
    page_number: Optional[int] = None
    extracted_text: Optional[str] = None
    verification_status: VerificationStatusEnum = VerificationStatusEnum.OBSERVED
    metadata_json: Dict[str, Any] = field(default_factory=dict)
    captured_at: datetime = field(default_factory=default_now)
    created_at: datetime = field(default_factory=default_now)


@dataclass
class Claim:
    id: uuid.UUID
    case_id: uuid.UUID
    source_id: uuid.UUID
    field_key: str
    claim_value: Dict[str, Any]
    confidence_score: Optional[Decimal] = None
    created_at: datetime = field(default_factory=default_now)


@dataclass
class Finding:
    id: uuid.UUID
    case_id: uuid.UUID
    severity: SeverityEnum
    summary: str
    status: str = "OPEN"
    details: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=default_now)


@dataclass
class DealChange:
    id: uuid.UUID
    case_id: uuid.UUID
    baseline_version_id: uuid.UUID
    final_version_id: uuid.UUID
    field_key: str
    category: ChangeCategoryEnum
    before_value: Dict[str, Any]
    after_value: Dict[str, Any]
    baseline_page: Optional[int] = None
    final_page: Optional[int] = None
    financial_impact_inr: Decimal = Decimal("0.00")
    finding_id: Optional[uuid.UUID] = None
    baseline_field_id: Optional[uuid.UUID] = None
    final_field_id: Optional[uuid.UUID] = None
    status: ChangeStatusEnum = ChangeStatusEnum.OPEN
    created_at: datetime = field(default_factory=default_now)


@dataclass
class DealChangeReview:
    id: uuid.UUID
    deal_change_id: uuid.UUID
    reviewer_id: uuid.UUID
    action: ReviewActionEnum
    note: str
    created_at: datetime = field(default_factory=default_now)


@dataclass
class ReviewDecision:
    id: uuid.UUID
    case_id: uuid.UUID
    reviewer_id: uuid.UUID
    decision: DecisionEnum
    justification: str
    created_at: datetime = field(default_factory=default_now)


@dataclass
class AuditEvent:
    id: uuid.UUID
    org_id: uuid.UUID
    actor_id: uuid.UUID
    action: str
    payload_json: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=default_now)


@dataclass
class AdvanceExposureResult:
    baseline_total: Decimal
    baseline_advance_percentage: Decimal
    baseline_advance_amount: Decimal
    final_total: Decimal
    final_advance_percentage: Decimal
    final_advance_amount: Decimal
    exposure_delta_amount: Decimal
    is_exposure_increased: bool
    currency: str = "INR"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "baseline_total": str(self.baseline_total),
            "baseline_advance_percentage": str(self.baseline_advance_percentage),
            "baseline_advance_amount": str(self.baseline_advance_amount),
            "final_total": str(self.final_total),
            "final_advance_percentage": str(self.final_advance_percentage),
            "final_advance_amount": str(self.final_advance_amount),
            "exposure_delta_amount": str(self.exposure_delta_amount),
            "is_exposure_increased": self.is_exposure_increased,
            "currency": self.currency,
        }
