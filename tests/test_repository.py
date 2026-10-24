"""
Tests for Full Procurement Evidence Lifecycle in Repository
Verifies complete end-to-end purchasing case flow matching the benchmark scenario.
"""

from decimal import Decimal
import uuid
import pytest

from trustchain.database.models import (
    RoleEnum,
    DocTypeEnum,
    DealStageEnum,
    ResearchStatusEnum,
    EvidenceKindEnum,
    VerificationStatusEnum,
    SeverityEnum,
    ChangeCategoryEnum,
    ChangeStatusEnum,
    ReviewActionEnum,
    DecisionEnum,
    EvidenceSource,
    Finding,
    DealChange,
)
from trustchain.database.security import TenantSecurityContext
from trustchain.database.repository import SupabaseRepository
from trustchain.database.storage import StorageService


@pytest.fixture
def repo():
    return SupabaseRepository(in_memory_mode=True)


@pytest.fixture
def buyer_context():
    return TenantSecurityContext(
        user_id=uuid.UUID("10000000-0000-0000-0000-000000000001"),
        org_id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        role=RoleEnum.BUYER,
        email="anil.sharma@sharmaauto.in",
    )


@pytest.fixture
def reviewer_context():
    return TenantSecurityContext(
        user_id=uuid.UUID("10000000-0000-0000-0000-000000000002"),
        org_id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        role=RoleEnum.REVIEWER,
        email="priya.nair@sharmaauto.in",
    )


def test_full_procurement_investigation_lifecycle(repo, buyer_context, reviewer_context):
    # 1. Create Purchase Case
    case = repo.create_purchase_case(
        context=buyer_context,
        title="Steel Components — October Investigation",
        case_number="TC-2026-10-001",
        target_item="Auto Stamping Steel Components",
        target_quantity=5000,
        currency="INR",
    )
    assert case.title == "Steel Components — October Investigation"
    assert case.currency == "INR"

    # 2. Register Supplier and Attach to Case
    supplier = repo.register_supplier(
        context=buyer_context,
        legal_name="SteelForge Industrial Supplies Pvt Ltd",
        website_url="https://steelforge-industries.in",
        gstin="07AABCS1429B1Z2",
    )
    repo.attach_supplier_to_case(buyer_context, case.id, supplier.id, is_primary=True)

    # 3. Register Private Documents
    key_quote = StorageService.generate_storage_key(buyer_context.org_id, case.id)
    doc_quote = repo.register_document(
        context=buyer_context,
        case_id=case.id,
        supplier_id=supplier.id,
        doc_type=DocTypeEnum.ACCEPTED_QUOTE,
        storage_key=key_quote,
        file_name="Accepted_Quotation_SteelForge_Q420.pdf",
        file_size=382100,
    )

    key_pi = StorageService.generate_storage_key(buyer_context.org_id, case.id)
    doc_pi = repo.register_document(
        context=buyer_context,
        case_id=case.id,
        supplier_id=supplier.id,
        doc_type=DocTypeEnum.FINAL_PI,
        storage_key=key_pi,
        file_name="Final_Proforma_Invoice_PI8821.pdf",
        file_size=412950,
    )

    docs = repo.list_case_documents(buyer_context, case.id)
    assert len(docs) == 2

    # 4. Save Commercial Deal Versions
    ver_quote = repo.save_deal_version(
        context=buyer_context,
        case_id=case.id,
        stage=DealStageEnum.ACCEPTED_QUOTE,
        total_amount=480000,
        advance_percentage=30,
        delivery_timeline_days=7,
        document_id=doc_quote.id,
        supplier_id=supplier.id,
    )
    assert ver_quote.advance_amount == Decimal("144000.00")

    ver_pi = repo.save_deal_version(
        context=buyer_context,
        case_id=case.id,
        stage=DealStageEnum.FINAL_PI,
        total_amount=480000,
        advance_percentage=80,
        delivery_timeline_days=20,
        document_id=doc_pi.id,
        supplier_id=supplier.id,
    )
    assert ver_pi.advance_amount == Decimal("384000.00")

    # 5. Save TinyFish Public Research Run
    tf_run = repo.save_public_research_run(
        context=buyer_context,
        case_id=case.id,
        tinyfish_run_id="tf_run_live_7a9f82d01",
        target_url="https://steelforge-industries.in/commercial-terms",
        status=ResearchStatusEnum.COMPLETED,
        raw_result={"terms_found": "25-30% standard advance"},
    )
    assert tf_run.tinyfish_run_id == "tf_run_live_7a9f82d01"

    # 6. Save Evidence Sources
    src_quote_p2 = EvidenceSource(
        id=uuid.uuid4(),
        case_id=case.id,
        kind=EvidenceKindEnum.PRIVATE_PDF,
        document_id=doc_quote.id,
        page_number=2,
        extracted_text="Thickness: 8.00 mm (+/- 0.05 mm)",
        verification_status=VerificationStatusEnum.VERIFIED_MATCH,
    )
    src_pi_p1 = EvidenceSource(
        id=uuid.uuid4(),
        case_id=case.id,
        kind=EvidenceKindEnum.PRIVATE_PDF,
        document_id=doc_pi.id,
        page_number=1,
        extracted_text="Thickness: 6.00 mm",
        verification_status=VerificationStatusEnum.DISCREPANCY,
    )
    repo.save_evidence_sources(buyer_context, [src_quote_p2, src_pi_p1])

    # 7. Save Findings
    finding_adv = Finding(
        id=uuid.uuid4(),
        case_id=case.id,
        severity=SeverityEnum.CRITICAL,
        summary="Advance increased from 30% to 80%, exposing INR 240,000 additional risk.",
    )
    finding_mat = Finding(
        id=uuid.uuid4(),
        case_id=case.id,
        severity=SeverityEnum.HIGH,
        summary="Material thickness downgraded from 8mm to 6mm.",
    )
    repo.save_findings(buyer_context, [finding_adv, finding_mat])

    # 8. Save Deal Changes
    chg_adv = DealChange(
        id=uuid.uuid4(),
        case_id=case.id,
        finding_id=finding_adv.id,
        baseline_version_id=ver_quote.id,
        final_version_id=ver_pi.id,
        field_key="advance_percentage",
        category=ChangeCategoryEnum.COMMERCIAL,
        before_value={"value": 30, "unit": "%", "amount_inr": 144000},
        after_value={"value": 80, "unit": "%", "amount_inr": 384000},
        baseline_page=1,
        final_page=1,
        financial_impact_inr=Decimal("240000.00"),
        status=ChangeStatusEnum.OPEN,
    )
    chg_mat = DealChange(
        id=uuid.uuid4(),
        case_id=case.id,
        finding_id=finding_mat.id,
        baseline_version_id=ver_quote.id,
        final_version_id=ver_pi.id,
        field_key="steel_thickness_mm",
        category=ChangeCategoryEnum.TECHNICAL,
        before_value={"value": 8, "unit": "mm"},
        after_value={"value": 6, "unit": "mm"},
        baseline_page=2,
        final_page=1,
        financial_impact_inr=Decimal("0.00"),
        status=ChangeStatusEnum.OPEN,
    )
    repo.save_deal_changes(buyer_context, [chg_adv, chg_mat])

    deal_changes = repo.list_deal_changes(buyer_context, case.id)
    assert len(deal_changes) == 2

    # 9. Human Review of Line-Item Deal Changes
    rev_mat = repo.append_deal_change_review(
        context=reviewer_context,
        deal_change_id=chg_mat.id,
        action=ReviewActionEnum.NEEDS_ENGINEER,
        note="Downgrade to 6mm violates chassis load specifications. QA lead must review.",
    )
    assert rev_mat.action == ReviewActionEnum.NEEDS_ENGINEER

    # 10. Overall Human Review Decision
    rev_decision = repo.append_review_decision(
        context=reviewer_context,
        case_id=case.id,
        decision=DecisionEnum.REQUEST_SUPPLIER_CLARIFICATION,
        justification="Advance increased by INR 240,000 and thickness dropped 2mm. Hold payment.",
    )
    assert rev_decision.decision == DecisionEnum.REQUEST_SUPPLIER_CLARIFICATION

    # 11. Audit Events Verification
    audit_events = repo.list_audit_events(buyer_context)
    actions = [e.action for e in audit_events]
    assert "PURCHASE_CASE_CREATED" in actions
    assert "SUPPLIER_REGISTERED" in actions
    assert "DOCUMENT_REGISTERED" in actions
    assert "RESEARCH_RUN_RECORDED" in actions
    assert "DEAL_CHANGE_REVIEW_SUBMITTED" in actions
    assert "REVIEW_DECISION_RECORDED" in actions
