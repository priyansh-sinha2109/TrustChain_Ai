# TrustChain AI — Shared Data Contracts

**Version:** 0.2.0  
**Target Audience:** Member 1 (FastAPI Backend) & Member 2 (Next.js Frontend)  
**Author:** Member 3 (Supabase & Data Persistence Layer)

---

## 1. Quick Integration for Member 1 (FastAPI)

Member 1 can directly instantiate the repository and invoke strongly-typed data methods:

```python
from trustchain.database import (
    SupabaseRepository,
    TenantSecurityContext,
    calculate_advance_exposure,
    RoleEnum,
    DocTypeEnum,
    DealStageEnum,
    ResearchStatusEnum,
)

# 1. Initialize repository with Supabase connection
repo = SupabaseRepository()

# 2. Build tenant security context from authenticated request
context = TenantSecurityContext(
    user_id=request.state.user_id,
    org_id=request.state.org_id,
    role=RoleEnum(request.state.role), # "buyer", "reviewer", or "admin"
)

# 3. Create a purchasing case
case = repo.create_purchase_case(
    context=context,
    title="Steel Components — October Investigation",
    case_number="TC-2026-10-001",
    target_item="Auto Stamping Steel Components",
    target_quantity=5000,
)
```

---

## 2. Shared JSON Payloads & API Contracts

### A. Document Upload Ticket Request & Response

#### Request (Frontend -> Backend):
```json
{
  "case_id": "d0000000-0000-0000-0000-000000000001",
  "doc_type": "FINAL_PI",
  "file_name": "Final_Proforma_Invoice_PI8821.pdf",
  "file_size": 412950,
  "mime_type": "application/pdf"
}
```

#### Response (Backend -> Frontend):
```json
{
  "document_id": "e0000000-0000-0000-0000-000000000003",
  "storage_key": "a0000000-0000-0000-0000-000000000001/d0000000-0000-0000-0000-000000000001/e0000000-0000-0000-0000-000000000003.pdf",
  "bucket": "case-documents",
  "upload_url": "https://your-project.supabase.co/storage/v1/object/upload/sign/case-documents/...",
  "expires_in_seconds": 3600,
  "required_headers": {
    "Content-Type": "application/pdf"
  }
}
```

---

### B. Extracted Commercial Deal Change (USP)

Stored representation of a detected discrepancy:

```json
{
  "id": "cc000000-0000-0000-0000-000000000001",
  "case_id": "d0000000-0000-0000-0000-000000000001",
  "baseline_version_id": "f0000000-0000-0000-0000-000000000002",
  "final_version_id": "f0000000-0000-0000-0000-000000000003",
  "field_key": "steel_thickness_mm",
  "category": "TECHNICAL",
  "before_value": {
    "value": 8,
    "unit": "mm"
  },
  "after_value": {
    "value": 6,
    "unit": "mm"
  },
  "baseline_page": 2,
  "final_page": 1,
  "financial_impact_inr": "0.00",
  "status": "OPEN"
}
```

#### Advance Percentage Escalation Example:
```json
{
  "id": "cc000000-0000-0000-0000-000000000002",
  "case_id": "d0000000-0000-0000-0000-000000000001",
  "field_key": "advance_percentage",
  "category": "COMMERCIAL",
  "before_value": {
    "value": 30,
    "unit": "%",
    "amount_inr": 144000
  },
  "after_value": {
    "value": 80,
    "unit": "%",
    "amount_inr": 384000
  },
  "baseline_page": 1,
  "final_page": 1,
  "financial_impact_inr": "240000.00",
  "status": "OPEN"
}
```

---

### C. TinyFish Public Research Run Metadata

When Member 1 finishes running the TinyFish agent, persist the run metadata:

```json
{
  "case_id": "d0000000-0000-0000-0000-000000000001",
  "tinyfish_run_id": "tf_run_live_7a9f82d01",
  "target_url": "https://steelforge-industries.in/commercial-terms",
  "status": "COMPLETED",
  "raw_result": {
    "pages_analyzed": 3,
    "terms_found": {
      "standard_advance": "25-30% for verified MSME buyers",
      "default_lead_time": "7-10 business days"
    },
    "source_urls": [
      "https://steelforge-industries.in/terms",
      "https://steelforge-industries.in/about"
    ]
  }
}
```

*Note:* Never pass API keys or buyer confidential quotations in `raw_result`.

---

### D. Human Line-Item Review Decision (PRD v0.2 USP)

Reviewers (e.g. Finance Head or QA Lead) review individual deal changes:

#### Allowed Actions:
- `ACKNOWLEDGED`: Reviewer accepts the commercial/technical variance.
- `REQUEST_INFO`: Supplier must explain or revert the discrepancy before proceeding.
- `NEEDS_ENGINEER`: Technical change requires shop-floor/metallurgy engineer sign-off.

#### Payload:
```json
{
  "deal_change_id": "cc000000-0000-0000-0000-000000000001",
  "action": "NEEDS_ENGINEER",
  "note": "Downgrade to 6mm violates chassis load specifications. Production lead must verify."
}
```

---

### E. Overall Human Sign-Off Decision

Final authority decision before advance disbursement:

#### Allowed Decisions:
- `APPROVE_ADVANCE`
- `REJECT_PAYMENT`
- `REQUEST_SUPPLIER_CLARIFICATION`
- `ESCALATE_TO_MANAGEMENT`

#### Payload:
```json
{
  "case_id": "d0000000-0000-0000-0000-000000000001",
  "decision": "REQUEST_SUPPLIER_CLARIFICATION",
  "justification": "Pre-advance verification identified +INR 240,000 unexpected advance exposure and a 2mm material thickness deficit. Hold payment until supplier re-issues compliant PI."
}
```
