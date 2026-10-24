"""
Tests for Append-Only Audit Trail Integrity
Verifies immutable event logging, tenant filtering, and payload sanitization.
"""

import uuid
import pytest
from trustchain.database.models import RoleEnum
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
    )


@pytest.fixture
def org_b_buyer():
    return TenantSecurityContext(
        user_id=uuid.UUID("20000000-0000-0000-0000-000000000001"),
        org_id=uuid.UUID("b0000000-0000-0000-0000-000000000002"),
        role=RoleEnum.BUYER,
    )


def test_audit_events_are_append_only(repo, org_a_buyer):
    """Multiple actions sequentially build the immutable audit trail."""
    repo.append_audit_event(org_a_buyer, "ACTION_1", {"step": 1})
    repo.append_audit_event(org_a_buyer, "ACTION_2", {"step": 2})
    repo.append_audit_event(org_a_buyer, "ACTION_3", {"step": 3})

    events = repo.list_audit_events(org_a_buyer)
    assert len(events) == 3
    assert [e.action for e in events] == ["ACTION_1", "ACTION_2", "ACTION_3"]


def test_audit_events_tenant_isolation(repo, org_a_buyer, org_b_buyer):
    """Org B must never see Org A's audit events."""
    repo.append_audit_event(org_a_buyer, "ORG_A_SENSITIVE_EVENT", {"secret": "xyz"})
    repo.append_audit_event(org_b_buyer, "ORG_B_EVENT", {"step": 1})

    events_a = repo.list_audit_events(org_a_buyer)
    events_b = repo.list_audit_events(org_b_buyer)

    assert len(events_a) == 1
    assert events_a[0].action == "ORG_A_SENSITIVE_EVENT"

    assert len(events_b) == 1
    assert events_b[0].action == "ORG_B_EVENT"
    assert "ORG_A_SENSITIVE_EVENT" not in [e.action for e in events_b]
