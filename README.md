# TrustChain_Ai

TrustChain AI - The Last Check Before You Pay.

FastAPI backend for approved purchasing-document comparisons, Decimal advance exposure,
and source-backed public supplier observations through TinyFish.

See [backend setup and integration contract](docs/backend-api-contract.md) for commands,
endpoint schemas, adapter requirements and tested limitations.

Assigned branch: `Backend`. Production persistence requires Member 3's repository
adapter. Unconfigured services return explicit errors. OCR, reports and deployment
are deferred. No frontend or database migrations are included.

## Data layer documentation

# TrustChain AI — The Last Check Before You Pay

**Evidence-Backed Pre-Advance Purchasing Verification for Indian Manufacturing MSMEs**  
*Developed by Team Ashwamedha for HackIIITD 2026 (18-Hour Hackathon)*

---

## 1. Overview

Before an Indian manufacturing MSME disburses an advance payment to a supplier, subtle terms often shift between the **Accepted Quotation** and the **Final Proforma Invoice (PI)**:
- Material thickness or grade downgrade (e.g., 8 mm -> 6 mm)
- Advance commitment escalations (e.g., 30% -> 80%, exposing buyer to additional unbacked risk)
- Delivery timeline extensions (e.g., 7 days -> 20 days)

TrustChain AI detects these discrepancies, links every finding to original document page numbers or public web evidence, and calculates the exact financial advance exposure increase.

---

## 2. Evidence & Data Persistence Layer (Member 3 Scope)

This branch (`feat/supabase-evidence-layer`) establishes the complete data, storage, and security foundation for TrustChain AI:

- **PostgreSQL Schemas & Migrations (`supabase/migrations/`)**:
  - `20261024000001_core_procurement_schema.sql`: Multi-tenant organizations, suppliers, cases, documents, RLS.
  - `20261024000002_evidence_and_usp_layer.sql`: Commercial deal versions, TinyFish public run metadata, evidence provenance, deal changes, audit log.
  - `20261024000003_storage_policies.sql`: Private buckets (`case-documents`, `case-reports`) with strict `{org_id}/{case_id}/{doc_id}.pdf` storage paths.
- **Benchmark Seed Data (`supabase/seed.sql`)**:
  - Sharma Auto Parts purchasing 5,000 steel components with ₹240,000 unexpected advance exposure increase and 2 mm thickness drop.
- **Python Repository & Service Layer (`trustchain/database/`)**:
  - Strongly typed dataclasses using Python `Decimal` for financial amounts.
  - Advance exposure engine (`calculate_advance_exposure`).
  - Zero-trust multi-tenant authorization (`TenantAuthorizer`).
  - Private storage manager and signed upload instruction generator (`StorageService`).
  - Reusable repository operations for FastAPI (`SupabaseRepository`).
- **Comprehensive Test Suite (`tests/`)**:
  - 18 automated tests covering advance calculations, storage validation, tenant isolation, and full investigation lifecycle.
- **Documentation (`docs/database/`)**:
  - `SCHEMA_ARCHITECTURE.md`: Complete entity-relationship model and schema specifications.
  - `DATA_CONTRACTS.md`: Shared API payloads for FastAPI (Member 1) and Next.js (Member 2).
  - `MIGRATION_GUIDE.md`: Safe cloud deployment instructions.
  - `SECURITY_AUDIT.md`: RLS and zero-trust verification report.

---

## 3. Quick Start & Test Execution

```bash
# 1. Activate virtual environment
.\.venv\Scripts\Activate.ps1

# 2. Run automated test suite
pytest -v
```

All 18 tests pass deterministically in under 0.2s.

## Current integration branch

`integration/backend-supabase` preserves both branches and adds the async Supabase adapter,
transactional investigation jobs/results, real Storage signing, verified tenant resolution
and reviewer baseline approval. See [integration migrations](docs/database/INTEGRATION_MIGRATIONS.md),
[backend API handoff](docs/backend-api-contract.md) and [generated frontend types](docs/backend-api-types.ts).
The earlier member summaries above describe their original delivery, not live deployment status.
Hosted readiness requires a verified database connection, applied migrations and the opt-in live suite.
