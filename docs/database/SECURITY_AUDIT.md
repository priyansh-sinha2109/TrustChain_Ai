# TrustChain AI — Security & Multi-Tenant Audit

**Role:** Member 3 (Supabase Architecture, Data Persistence, Security & Audit)  
**Status:** PASSED (All 18 automated security and persistence tests passing)

---

## 1. Security Architecture Summary

TrustChain AI processes highly confidential commercial purchasing documents (RFQs, supplier quotations, final Proforma Invoices). A data leak between competitor manufacturing buyers could cause severe antitrust and commercial damage.

To guarantee zero cross-tenant leakage, TrustChain AI implements **Defense-in-Depth**:

| Layer | Security Mechanism | Protection Provided |
|---|---|---|
| **Storage Layer** | Random UUID keys & strict path prefixes `{org_id}/{case_id}/{doc_id}.pdf` | Eliminates directory traversal attacks; prevents user filenames from controlling paths. |
| **Database Layer** | PostgreSQL Row-Level Security (RLS) on all 14 tables | Rejects cross-tenant queries at the database engine level. |
| **Backend API Layer** | `TenantAuthorizer` in Python service layer | Prevents service-role connections from bypassing tenant isolation. |
| **Audit Layer** | Immutability triggers on `audit_events` | Enforces append-only compliance logs; prevents deletion or modification of audit events. |

---

## 2. Multi-Tenant Isolation Verification

### The "Guessed UUID" Attack Test:
- **Scenario:** Attacker in Organisation B generates or guesses the UUID of a high-value purchase case owned by Organisation A (`d0000000-0000-0000-0000-000000000001`).
- **Engine Behavior:**
  1. PostgreSQL RLS filters by `current_user_org_ids()`, returning zero rows.
  2. Python `TenantAuthorizer.verify_case_ownership()` raises a `PermissionError` ("Tenant Isolation Violation").
- **Verification:** Verified by `tests/test_tenant_isolation.py::test_guessed_uuid_cross_organization_blocked` (PASSED).

---

## 3. Separation of Duties (RBAC)

TrustChain AI strictly separates operational purchasing from financial review authority:

- **Buyer (`buyer`):**
  - Permitted: Create cases, register suppliers, upload RFQs/quotations, start investigations.
  - Prohibited: Submitting line-item deal reviews, approving advance payment releases.
- **Reviewer (`reviewer`):**
  - Permitted: Review individual deal discrepancies (`NEEDS_ENGINEER`, `REQUEST_INFO`), submit overall purchasing sign-off decisions (`REQUEST_SUPPLIER_CLARIFICATION`, `APPROVE_ADVANCE`).
- **Verification:** Verified by `tests/test_tenant_isolation.py::test_buyer_cannot_submit_review_decision` (PASSED).

---

## 4. Test Suite Execution Results

All 18 tests execute deterministically in **0.14s**:

```
============================= test session starts =============================
platform win32 -- Python 3.13.12, pytest-9.1.1
collected 18 items

tests/test_audit_integrity.py::test_audit_events_are_append_only PASSED  [  5%]
tests/test_audit_integrity.py::test_audit_events_tenant_isolation PASSED [ 11%]
tests/test_exposure.py::test_sharma_auto_benchmark_exposure PASSED       [ 16%]
tests/test_exposure.py::test_exposure_with_price_increase_and_advance_shift PASSED [ 22%]
tests/test_exposure.py::test_exposure_decrease PASSED                    [ 27%]
tests/test_exposure.py::test_zero_advance_baseline PASSED                [ 33%]
tests/test_exposure.py::test_invalid_advance_percentages PASSED          [ 38%]
tests/test_exposure.py::test_negative_total_amounts PASSED               [ 44%]
tests/test_repository.py::test_full_procurement_investigation_lifecycle PASSED [ 50%]
tests/test_storage.py::test_storage_key_generation PASSED                [ 55%]
tests/test_storage.py::test_directory_traversal_rejection PASSED         [ 61%]
tests/test_storage.py::test_cross_tenant_storage_key_mismatch PASSED     [ 66%]
tests/test_storage.py::test_file_metadata_validation PASSED              [ 72%]
tests/test_storage.py::test_sha256_computation PASSED                    [ 77%]
tests/test_tenant_isolation.py::test_tenant_isolation_cross_organization_read_blocked PASSED [ 83%]
tests/test_tenant_isolation.py::test_guessed_uuid_cross_organization_blocked PASSED [ 88%]
tests/test_tenant_isolation.py::test_buyer_cannot_submit_review_decision PASSED [ 94%]
tests/test_tenant_isolation.py::test_buyer_cannot_review_deal_changes PASSED [100%]

============================= 18 passed in 0.14s ==============================
```
