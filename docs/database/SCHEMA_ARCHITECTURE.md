# TrustChain AI — Database Schema Architecture

**Version:** 0.2.0 (HackIIITD 2026)  
**Role:** Member 3 (Supabase Architecture, Data Persistence, Evidence & Quality Engineering)  
**Database:** PostgreSQL 15+ (Cloud-Hosted Supabase)

---

## 1. Architectural Overview & Design Philosophy

TrustChain AI is an evidence-backed pre-advance purchasing verification platform for Indian manufacturing MSMEs. Its data architecture enforces four non-negotiable principles:

1. **Complete Multi-Tenant Isolation:** All procurement records belong to a specific `organization`. Cross-tenant reading or modification is prohibited via PostgreSQL Row-Level Security (RLS) and zero-trust backend authorization.
2. **Immutable Evidence Provenance:** Every contradiction, discrepancy, or match links directly to an `evidence_source` (a private PDF page reference or public web URL). No claims are fabricated or detached from source documents.
3. **Pre-Advance Commercial Discrepancy Tracking (USP):** The core commercial differentiation resides in `deal_versions` (RFQ vs Accepted Quote vs Final PI) and `deal_changes` (line-item delta tracking with financial exposure calculation).
4. **Append-Only Tamper-Evident Auditability:** Human purchasing reviews (`deal_change_reviews`, `review_decisions`) and system lifecycle milestones (`audit_events`) are append-only. Existing records cannot be updated or erased.

---

## 2. Entity Relationship Model

```
                    ┌─────────────────────────┐
                    │      organizations      │
                    └────────────┬────────────┘
                                 │ 1:N
        ┌────────────────────────┼────────────────────────┐
        │ 1:N                    │ 1:N                    │ 1:N
┌───────┴──────────────┐ ┌───────┴──────────────┐ ┌───────┴──────────────┐
│ organization_members │ │      suppliers       │ │     audit_events     │
└──────────────────────┘ └───────┬──────────────┘ └──────────────────────┘
                                 │ 1:N (scoped)
                                 │
                    ┌────────────┴────────────┐
                    │     purchase_cases      │
                    └────────────┬────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │ 1:N                    │ 1:N                    │ 1:N
┌───────┴──────────────┐ ┌───────┴──────────────┐ ┌───────┴──────────────┐
│      documents       │ │ public_research_runs │ │   review_decisions   │
│  (storage metadata)  │ │   (TinyFish runs)    │ │   (human sign-off)   │
└───────┬──────────────┘ └──────────────────────┘ └──────────────────────┘
        │ 1:N
┌───────┴──────────────┐
│    deal_versions     │ (RFQ, ACCEPTED_QUOTE, FINAL_PI)
└───────┬──────────────┘
        │ 1:N (cross-version diff)
┌───────┴──────────────┐ 1:N ┌────────────────────────┐
│     deal_changes     │─────│  deal_change_reviews   │ (ACKNOWLEDGED, REQUEST_INFO, NEEDS_ENGINEER)
└───────┬──────────────┘     └────────────────────────┘
        │ 1:1 (optional)
┌───────┴──────────────┐
│       findings       │
└───────┬──────────────┘
        │ 1:N
┌───────┴──────────────┐ 1:N ┌────────────────────────┐
│   evidence_sources   │─────│         claims         │
│ (PDF page / Web URL) │     │ (normalized kv pairs)  │
└──────────────────────┘     └────────────────────────┘
```

---

## 3. Core Tables Specification

### A. Organizations & Access Control

#### `organizations`
Tenant boundary for manufacturing MSMEs and buyer companies.
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL) — e.g., "Sharma Auto Components Pvt Ltd"
- `slug` (TEXT, UNIQUE, NOT NULL)
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### `organization_members`
Maps Supabase Auth users to organizations with assigned RBAC roles.
- `id` (UUID, Primary Key)
- `org_id` (UUID, Foreign Key -> `organizations.id` ON DELETE CASCADE)
- `user_id` (UUID, Supabase Auth `auth.users.id`)
- `role` (TEXT, NOT NULL, CHECK: `'buyer'`, `'reviewer'`, `'admin'`)
- `joined_at` (TIMESTAMPTZ)
- *Constraint:* `UNIQUE(org_id, user_id)`

---

### B. Procurement & Case Management

#### `suppliers`
Candidate and verified suppliers scoped to the buyer's organization.
- `id` (UUID, Primary Key)
- `org_id` (UUID, Foreign Key -> `organizations.id` ON DELETE CASCADE)
- `legal_name` (TEXT, NOT NULL) — e.g., "SteelForge Industrial Supplies Pvt Ltd"
- `trade_name` (TEXT)
- `gstin` (TEXT)
- `pan` (TEXT)
- `website_url` (TEXT)
- `contact_email` (TEXT)
- `contact_phone` (TEXT)
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### `purchase_cases`
Pre-advance purchasing investigations.
- `id` (UUID, Primary Key)
- `org_id` (UUID, Foreign Key -> `organizations.id` ON DELETE CASCADE)
- `case_number` (TEXT, NOT NULL) — e.g., "TC-2026-10-001"
- `title` (TEXT, NOT NULL) — e.g., "Steel Components — October Investigation"
- `status` (TEXT, CHECK: `'DRAFT'`, `'DOCS_UPLOADED'`, `'RESEARCHING'`, `'ANALYZED'`, `'IN_REVIEW'`, `'APPROVED'`, `'REJECTED'`, `'FLAGGED'`)
- `currency` (CHAR(3), DEFAULT `'INR'`)
- `target_item` (TEXT)
- `target_quantity` (NUMERIC(14, 2))
- `created_by` (UUID)
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### `case_suppliers`
Mapping table linking purchase cases to candidate suppliers.
- `id` (UUID, Primary Key)
- `case_id` (UUID, Foreign Key -> `purchase_cases.id` ON DELETE CASCADE)
- `supplier_id` (UUID, Foreign Key -> `suppliers.id` ON DELETE CASCADE)
- `is_primary` (BOOLEAN, DEFAULT true)

#### `documents`
Metadata for private procurement documents stored in Supabase Storage (`case-documents`).
- `id` (UUID, Primary Key)
- `case_id` (UUID, Foreign Key -> `purchase_cases.id` ON DELETE CASCADE)
- `supplier_id` (UUID, Foreign Key -> `suppliers.id` ON DELETE SET NULL)
- `doc_type` (TEXT, CHECK: `'RFQ'`, `'ACCEPTED_QUOTE'`, `'PURCHASE_ORDER'`, `'FINAL_PI'`, `'OTHER'`)
- `storage_key` (TEXT, NOT NULL) — format: `{org_id}/{case_id}/{document_uuid}.pdf`
- `file_name` (TEXT, NOT NULL)
- `mime_type` (TEXT, DEFAULT `'application/pdf'`)
- `file_size` (BIGINT, CHECK > 0)
- `sha256` (TEXT) — file integrity digest
- `status` (TEXT, CHECK: `'PENDING'`, `'UPLOADED'`, `'PROCESSING'`, `'EXTRACTED'`, `'ERROR'`)
- `created_at` (TIMESTAMPTZ)

---

### C. Commercial Versions & Deal Changes (USP)

#### `deal_versions`
Extracted milestones representing commercial agreement stages.
- `id` (UUID, Primary Key)
- `case_id` (UUID, Foreign Key -> `purchase_cases.id` ON DELETE CASCADE)
- `supplier_id` (UUID, Foreign Key -> `suppliers.id`)
- `document_id` (UUID, Foreign Key -> `documents.id`)
- `stage` (TEXT, CHECK: `'RFQ'`, `'ACCEPTED_QUOTE'`, `'PURCHASE_ORDER'`, `'FINAL_PI'`)
- `version_no` (INT, DEFAULT 1)
- `total_amount` (NUMERIC(14, 2))
- `advance_percentage` (NUMERIC(5, 2))
- `advance_amount` (NUMERIC(14, 2), GENERATED STORED: `(total_amount * advance_percentage) / 100`)
- `delivery_timeline_days` (INT)
- `notes` (TEXT)
- *Constraint:* `UNIQUE(case_id, stage, version_no)`

#### `deal_changes`
Line-item differences between agreed baseline quotation and final supplier PI.
- `id` (UUID, Primary Key)
- `finding_id` (UUID, Foreign Key -> `findings.id` ON DELETE SET NULL)
- `case_id` (UUID, Foreign Key -> `purchase_cases.id` ON DELETE CASCADE)
- `baseline_version_id` (UUID, Foreign Key -> `deal_versions.id` ON DELETE CASCADE)
- `final_version_id` (UUID, Foreign Key -> `deal_versions.id` ON DELETE CASCADE)
- `field_key` (TEXT, NOT NULL) — e.g., `'steel_thickness_mm'`, `'advance_percentage'`
- `category` (TEXT, CHECK: `'TECHNICAL'`, `'COMMERCIAL'`)
- `before_value` (JSONB, NOT NULL) — e.g., `{"value": 8, "unit": "mm"}`
- `after_value` (JSONB, NOT NULL) — e.g., `{"value": 6, "unit": "mm"}`
- `baseline_page` (INT) — page in accepted quotation PDF
- `final_page` (INT) — page in final PI PDF
- `financial_impact_inr` (NUMERIC(14, 2), DEFAULT 0.00)
- `status` (TEXT, CHECK: `'OPEN'`, `'ACKNOWLEDGED'`, `'REJECTED'`)
- *Trigger:* `check_deal_changes_case_consistency` ensures baseline and final versions belong to the same case.

#### `deal_change_reviews` (PRD v0.2 USP)
Line-item human reviewer decisions on individual discrepancies.
- `id` (UUID, Primary Key)
- `deal_change_id` (UUID, Foreign Key -> `deal_changes.id` ON DELETE CASCADE)
- `reviewer_id` (UUID, Supabase Auth user)
- `action` (TEXT, CHECK: `'ACKNOWLEDGED'`, `'REQUEST_INFO'`, `'NEEDS_ENGINEER'`)
- `note` (TEXT, NOT NULL)
- `created_at` (TIMESTAMPTZ)

---

### D. Public Research, Evidence & Audit

#### `public_research_runs`
Metadata from TinyFish public website investigations.
- `id` (UUID, Primary Key)
- `case_id` (UUID, Foreign Key -> `purchase_cases.id` ON DELETE CASCADE)
- `case_supplier_id` (UUID, Foreign Key -> `case_suppliers.id`)
- `tinyfish_run_id` (TEXT, NOT NULL) — real run ID provided by Member 1
- `target_url` (TEXT, NOT NULL)
- `status` (TEXT, CHECK: `'PENDING'`, `'RUNNING'`, `'COMPLETED'`, `'FAILED'`)
- `started_at` / `completed_at` (TIMESTAMPTZ)
- `error_code` (TEXT)
- `raw_result` (JSONB) — sanitised public observation payload (no API keys)

#### `evidence_sources`
Immutable provenance store linking findings to PDF pages or public URLs.
- `id` (UUID, Primary Key)
- `case_id` (UUID, Foreign Key -> `purchase_cases.id` ON DELETE CASCADE)
- `kind` (TEXT, CHECK: `'PUBLIC_WEB'`, `'PRIVATE_PDF'`)
- `source_url` (TEXT, required if `PUBLIC_WEB`)
- `document_id` (UUID, required if `PRIVATE_PDF`)
- `page_number` (INT)
- `extracted_text` (TEXT)
- `verification_status` (TEXT, CHECK: `'OBSERVED'`, `'VERIFIED_MATCH'`, `'DISCREPANCY'`, `'INSUFFICIENT_EVIDENCE'`)
- `metadata_json` (JSONB)

#### `claims`
Normalized key-value claims extracted from evidence sources with confidence scores.
- `id` (UUID, Primary Key)
- `case_id` (UUID)
- `source_id` (UUID, Foreign Key -> `evidence_sources.id`)
- `field_key` (TEXT)
- `claim_value` (JSONB)
- `confidence_score` (NUMERIC(3, 2))

#### `findings`
High-level categorized discrepancy findings.
- `id` (UUID, Primary Key)
- `case_id` (UUID)
- `status` (TEXT, CHECK: `'OPEN'`, `'FLAGGED'`, `'RESOLVED'`, `'DISMISSED'`)
- `severity` (TEXT, CHECK: `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'`)
- `summary` (TEXT, NOT NULL)
- `details` (JSONB)

#### `review_decisions`
Overall human purchasing authority decision before advance payment release.
- `id` (UUID, Primary Key)
- `case_id` (UUID)
- `reviewer_id` (UUID)
- `decision` (TEXT, CHECK: `'APPROVE_ADVANCE'`, `'REJECT_PAYMENT'`, `'REQUEST_SUPPLIER_CLARIFICATION'`, `'ESCALATE_TO_MANAGEMENT'`)
- `justification` (TEXT, NOT NULL)
- `created_at` (TIMESTAMPTZ)

#### `audit_events`
Append-only tamper-evident compliance audit trail.
- `id` (UUID, Primary Key)
- `org_id` (UUID)
- `actor_id` (UUID)
- `action` (TEXT)
- `payload_json` (JSONB)
- `created_at` (TIMESTAMPTZ)
- *Trigger:* `prevent_audit_tampering` raises an exception on any attempt to `UPDATE` or `DELETE`.

---

## 4. Advance Exposure Difference Calculation

Stored PostgreSQL function and Python engine formula:

$$\Delta_{\text{exposure}} = \frac{(\text{Total}_{\text{final}} \times \text{Advance\%}_{\text{final}}) - (\text{Total}_{\text{agreed}} \times \text{Advance\%}_{\text{agreed}})}{100}$$

### Benchmark Test Verification:
- **Agreed Quotation:** INR 480,000 @ 30% advance = **INR 144,000**
- **Final Proforma Invoice:** INR 480,000 @ 80% advance = **INR 384,000**
- **Exposure Delta:** $+ \text{INR 240,000}$ additional unbacked cash commitment.
