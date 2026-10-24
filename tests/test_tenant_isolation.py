"""
Tests for Multi-Tenant Isolation and RBAC Authorization
Verifies that:
1. User from Org B CANNOT read or modify cases owned by Org A.
2. A guessed UUID from another organization is strictly blocked with PermissionError.
3. Buyers cannot submit human review decisions or approve advances.
"""

import uuid
import pytest
from trustchain.database.models import (
    RoleEnum,
    DecisionEnum,
    ReviewActionEnum,
)
from trustchain.database.security import TenantSecurityContext
from trustchain.database.repository import SupabaseRepository


@pytest.fixture
def repo():
    return SupabaseRepository(in_memory_mode=True)


@pytest.fixture
def org_a_buyer():
    return TenantSecurityContext(
        user_id=uuid.UUID("10000000-0000-0000-0000-000000000001"),
        org_id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        role=RoleEnum.BUYER,
        email="buyer@sharmaauto.in",
    )


@pytest.fixture
def org_a_reviewer():
    return TenantSecurityContext(
        user_id=uuid.UUID("10000000-0000-0000-0000-000000000002"),
        org_id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
        role=RoleEnum.REVIEWER,
        email="reviewer@sharmaauto.in",
    )


@pytest.fixture
def org_b_buyer():
    return TenantSecurityContext(
        user_id=uuid.UUID("20000000-0000-0000-0000-000000000001"),
        org_id=uuid.UUID("b0000000-0000-0000-0000-000000000002"),
        role=RoleEnum.BUYER,
        email="buyer@apexeng.in",
    )


def test_tenant_isolation_cross_organization_read_blocked(repo, org_a_buyer, org_b_buyer):
    """Org A buyer creates a case. Org B buyer attempts to retrieve it by ID -> BLOCKED."""
    case = repo.create_purchase_case(
        context=org_a_buyer,
        title="Steel Components — October Investigation",
        case_number="TC-2026-10-001",
        target_item="Auto Stamping Steel Components",
        target_quantity=5000,
    )

    # Org A buyer can retrieve case
    retrieved = repo.get_purchase_case(org_a_buyer, case.id)
    assert retrieved is not None
    assert retrieved.id == case.id

    # Org B buyer attempts to retrieve Org A's case using guessed UUID -> PermissionError
    with pytest.raises(PermissionError, match="Tenant Isolation Violation"):
        repo.get_purchase_case(org_b_buyer, case.id)


def test_guessed_uuid_cross_organization_blocked(repo, org_a_buyer, org_b_buyer):
    """Guessed UUID of an existing case belonging to another tenant is blocked."""
    target_uuid = uuid.UUID("d0000000-0000-0000-0000-000000000001")
    repo.create_purchase_case(
        context=org_a_buyer,
        title="Secret Procurement Investigation",
        case_number="TC-CONFIDENTIAL-01",
        case_id=target_uuid,
    )

    with pytest.raises(PermissionError, match="Tenant Isolation Violation"):
        repo.get_purchase_case(org_b_buyer, target_uuid)


def test_buyer_cannot_submit_review_decision(repo, org_a_buyer, org_a_reviewer):
    """A buyer must NOT be able to approve payments or submit review decisions (Separation of Duties)."""
    case = repo.create_purchase_case(
        context=org_a_buyer,
        title="Case A",
        case_number="TC-001",
    )

    # Buyer attempting to submit review decision -> PermissionError
    with pytest.raises(PermissionError, match="RBAC Violation"):
        repo.append_review_decision(
            context=org_a_buyer,
            case_id=case.id,
            decision=DecisionEnum.APPROVE_ADVANCE,
            justification="Buyer self-approval",
        )

    # Reviewer CAN submit review decision
    rev_decision = repo.append_review_decision(
        context=org_a_reviewer,
        case_id=case.id,
        decision=DecisionEnum.REQUEST_SUPPLIER_CLARIFICATION,
        justification="Verified by authorized reviewer Priya Nair",
    )
    assert rev_decision.decision == DecisionEnum.REQUEST_SUPPLIER_CLARIFICATION


def test_buyer_cannot_review_deal_changes(repo, org_a_buyer, org_a_reviewer):
    """Only reviewers or admins can submit line-item deal change reviews."""
    change_id = uuid.uuid4()

    with pytest.raises(PermissionError, match="RBAC Violation"):
        repo.append_deal_change_review(
            context=org_a_buyer,
            deal_change_id=change_id,
            action=ReviewActionEnum.ACKNOWLEDGED,
            note="Buyer acknowledgment not permitted",
        )

    review = repo.append_deal_change_review(
        context=org_a_reviewer,
        deal_change_id=change_id,
        action=ReviewActionEnum.NEEDS_ENGINEER,
        note="Thickness downgrade requires QA engineer sign-off",
    )
    assert review.action == ReviewActionEnum.NEEDS_ENGINEER
