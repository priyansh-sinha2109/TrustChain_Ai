# Backend + Supabase integration delivery

Date: 24 October 2026. Verdict: **INTEGRATION NOT READY** for hosted use.
The code and isolated PostgreSQL workflow are ready for review; an authenticated hosted
end-to-end workflow has not passed. This report does not substitute mocked/local tests
for live Supabase verification.

## 1. Branches and preserved history

Backend source: `Backend` at d0c1aa4. Data source: `feat/supabase-evidence-layer` at
a513079. Working/delivery branch: `integration/backend-supabase`. The existing interrupted
merge was completed, retaining both parents. Ancestry checks passed for both source branches.
No source commits were rebased/deleted, no force push was used, and Backend/main were not merged.

## 2. Implemented adapter

Factory: `REPOSITORY_FACTORY=app.supabase_adapter:create_repository`.
Settings: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL.
Missing production configuration fails explicitly. No production memory fallback remains.

Implemented async methods: create_case, list_cases, get_case, list_documents,
upload_intent, confirm_upload, document_bytes, create_job, get_job, claim_job,
update_job, save_results, get_findings and save_review. Extra method approve_document
supports explicit reviewer approval. Existing frontend routes and comparison logic remain.

Member 3's SupabaseRepository, dataclasses, TenantSecurityContext, TenantAuthorizer and
StorageService are reused. A transaction client implements its get/post interface over
one psycopg connection. Four bounded executor threads keep SQL/Storage off the event loop.
Each operation commits/rolls back as a whole; independent REST POSTs are not called atomic.
Storage and provider HTTP side effects are external to the SQL transaction.

## 3. Migration status

All ten migrations executed successfully on a newly initialized, isolated native
PostgreSQL 18.6 cluster under the ignored tmp directory. Minimal Auth/Storage schema
stand-ins supported local migration/RLS testing. No shared database reset was performed.

The supplied hosted project's server key was accepted (REST and Storage metadata HTTP 200).
At read-only inspection, REST exposed only integration_checks, purchase_cases returned 404,
Storage listed zero buckets, and the signed-in dashboard showed No migrations.
Hosted catalog/history and migration application remain unverified without DATABASE_URL.
Committed SQL files are not represented as applied cloud migrations.

Original migrations 00001–00003 are preserved. Additions: active memberships (00004),
jobs/results (00005), upload reservations (00006), approvals (00007), provider state (00008),
case-aware Storage policies (00009), and version currency/SQL rounding (00010).
No duplicate procurement tables or competing production database were introduced.

## 4. Private Storage

StorageService now makes actual Supabase upload-sign and download-sign requests. It checks
returned origin/path/token instead of constructing fake URLs. Uploads use the provider's
fixed two-hour signature; downloads use a requested 60-second signature. The private
case-documents bucket and canonical org/case/document UUID path are preserved.

Confirmation requires an existing object, correct MIME/PDF bytes, exact reserved length,
streamed 10,000,000-byte bound, parser validation and SHA256 before metadata registration.
Download rechecks the registered hash and canonical association. Missing objects fail.
Storage RLS checks actual case membership and pending upload reservations, not only a
tenant-looking path. Signing/download HTTP tests are mocked; no real hosted upload was run.

## 5. Authentication, tenant isolation and approvals

The original Supabase access-token verifier is preserved. Every adapter operation queries
active memberships server-side, rejects absent/revoked/unknown-role or multiple memberships,
and constructs its own TenantSecurityContext. It verifies case organisation and action role.
No random organisation/admin context is assigned and no client org/role is trusted.

Reviewer/admin-only approvals are independent of uploads and bind an immutable approval to
the document's confirmed hash, approver, timestamp and note. Buyers cannot approve baselines
or submit purchasing decisions. No user-token authenticated hosted workflow has run yet.

## 6. Persistent investigations and result consistency

Jobs persist user/org/case, immutable request/fingerprint/key, status/stage, provider ID/state,
safe error, fenced five-minute lease, timestamps and terminal result association. Per-case
locks and unique constraints enforce atomic creation/idempotency. Claims are atomic and
stage writes renew leases. A replaced worker cannot write or mark the new worker failed.

Immutable provisional and terminal snapshots preserve one complete investigation response.
Terminal snapshots, existing-table evidence/claims, versions, findings, changes, exposure,
audit and terminal state commit in one SQL transaction. Identical terminal replay is safe.
Forced projection failure was verified to roll back all relational projection writes while
retaining the separately committed private snapshot. Retrieval after a new app instance passed.

BackgroundTasks do not guarantee durable execution. Explicit resume requires an expired
lease, and a provider start with unknown outcome requires reconciliation rather than a
blind repeat. No automatic scheduler or queue has been added.

## 7. Model mappings and frontend handoff

doc_type -> document_type, file_size -> size_bytes, mime_type -> content_type. Approved
comes from a hash-bound approval record. Case supplier identity comes from exactly one
primary same-organisation supplier association. INFO/WARNING/HIGH -> LOW/MEDIUM/HIGH.
Comparison status is preserved in findings.details, separate from database review status OPEN.

APPROVE -> APPROVE_ADVANCE; REJECT -> REJECT_PAYMENT;
REQUEST_CLARIFICATION -> REQUEST_SUPPLIER_CLARIFICATION. Provider CANCELLED is preserved
verbatim in job/metadata while mapping to the narrower research table's FAILED enum.
Missing version terms/currency/financial impact remain SQL NULL; version currency is never
relabeled with the case default. SQL exposure now rounds each advance before subtracting.

API/schema/types: docs/backend-api-contract.md, docs/backend-openapi.json and
docs/backend-api-types.ts. Existing paths are stable; the approval path and nullable provider
metadata are additive. Error OpenAPI models now match the actual safe response envelope.

## 8. Tests and live results

Existing suites were preserved. Baseline: 73 tests passed after the merge.
Final combined run: **104 passed, 2 skipped, 0 failed**. The skips are the opt-in live
Supabase and TinyFish tests. One upstream Starlette TestClient/httpx deprecation warning
remains. `pip check` and `compileall` passed.

Executed from the repository root with TRUSTCHAIN_TEST_DATABASE_URL set to the isolated
local PostgreSQL cluster:

```powershell
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests tests -q
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m compileall -q backend/app trustchain
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m scripts.verify_supabase
.\.venv\Scripts\python.exe -m scripts.tinyfish_smoke
```
Native SQL tests cover actual transactions, case/supplier/document writes, PDF parsing,
approval, idempotency/concurrency, fencing, rollback, evidence/claims/exposure, mocked-provider
partial results, restart retrieval, reviewer checks, tenant isolation and actual Storage RLS.
Their Auth and Storage HTTP are mocked. They are not live Supabase tests.

The opt-in live suite requires a designated test project, database URL and buyer/reviewer
tokens; it tests real Supabase Auth/SQL/Storage and a separately controlled TinyFish smoke run.
It is skipped when incomplete rather than falling back. The TinyFish smoke command actually
returned PUBLIC_RESEARCH_UNCONFIGURED: no real run ID or provider success is claimed.
The Supabase audit command returned DATABASE_URL_UNCONFIGURED and zero hosted buckets.

## 9. Remaining blockers and connection handoff

The dashboard verified the Session pooler host/user and password-placeholder URI. Its
non-secret template was saved as a comment in ignored .env. The database password cannot
be recovered from API keys/dashboard Connect; the user is resetting it and will configure
DATABASE_URL. No password reset or privileged credential change was performed by this agent.

After that: inspect hosted history/catalog; coordinate and apply pending migrations without
resetting data; provision dedicated test memberships/tokens; run the real Auth/Storage/API
workflow; supply a TinyFish key and execute its real smoke run. Hosted schema/RLS/Storage,
frontend-to-hosted integration and deployment remain incomplete. OCR/reports remain P1.
Credentials are local/ignored; staged scans found no provided keys or passwords in Git.

## 10. Git delivery and exact changed-file inventory

Each tested milestone has its own descriptive commit. Delivery is a draft
PR from integration/backend-supabase into Backend, with no automatic merge. The following
inventory includes Member 3's preserved merge additions and integration edits relative to Backend.


```text
A	.env.example
M	.gitignore
M	README.md
M	backend/.env.example
M	backend/app/config.py
A	backend/app/database_mapping.py
M	backend/app/investigation.py
M	backend/app/main.py
M	backend/app/models.py
M	backend/app/routes.py
A	backend/app/supabase_adapter.py
A	backend/app/supabase_results.py
M	backend/requirements.lock
M	backend/requirements.txt
A	backend/scripts/export_api_types.py
A	backend/scripts/verify_supabase.py
A	backend/tests/test_database_mapping.py
M	backend/tests/test_investigations.py
A	backend/tests/test_live_supabase.py
A	backend/tests/test_migration_audit.py
A	backend/tests/test_sql_integration.py
A	backend/tests/test_storage_signing.py
A	backend/tests/test_supabase_adapter.py
M	docs/backend-api-contract.md
A	docs/backend-api-types.ts
M	docs/backend-openapi.json
A	docs/database/DATA_CONTRACTS.md
A	docs/database/INTEGRATION_MIGRATIONS.md
A	docs/database/INTEGRATION_PLAN.md
A	docs/database/MIGRATION_GUIDE.md
A	docs/database/SCHEMA_ARCHITECTURE.md
A	docs/database/SECURITY_AUDIT.md
A	supabase/migrations/20261024000001_core_procurement_schema.sql
A	supabase/migrations/20261024000002_evidence_and_usp_layer.sql
A	supabase/migrations/20261024000003_storage_policies.sql
A	supabase/migrations/20261024000004_active_memberships.sql
A	supabase/migrations/20261024000005_persistent_investigations.sql
A	supabase/migrations/20261024000006_private_upload_reservations.sql
A	supabase/migrations/20261024000007_document_approvals.sql
A	supabase/migrations/20261024000008_provider_state.sql
A	supabase/migrations/20261024000009_storage_case_associations.sql
A	supabase/migrations/20261024000010_currency_and_rounding.sql
A	supabase/seed.sql
A	tests/__init__.py
A	tests/test_audit_integrity.py
A	tests/test_exposure.py
A	tests/test_repository.py
A	tests/test_storage.py
A	tests/test_tenant_isolation.py
A	trustchain/__init__.py
A	trustchain/database/__init__.py
A	trustchain/database/client.py
A	trustchain/database/exposure.py
A	trustchain/database/models.py
A	trustchain/database/repository.py
A	trustchain/database/security.py
A	trustchain/database/storage.py
A	trustchain/database/transaction_client.py
A	docs/integration-report.md
```

Integration commits (newest first):

```text
e131774 fix: stop stale investigation workers when a replacement owns the lease
d0714e3 test: verify document currencies remain independent of case defaults
4f8e1e7 fix: preserve document currencies and align SQL advance rounding with the backend
13a2e23 docs: publish stable API schemas, frontend types and Supabase setup contracts
63c9a9e test: verify SQL transactions, tenant isolation, leases and private Storage policies
ec88c32 docs: add read-only Supabase migration and private-bucket verification
9d1648d feat: persist job-versioned findings and evidence in one PostgreSQL transaction
441593b feat: map evidence severity and review decisions without conflating statuses
822fec3 feat: require auditable reviewer approval of confirmed purchasing baselines
e17afb1 feat: sign private Storage URLs and verify bounded PDF upload confirmations
179944e feat: add persistent investigation jobs with fenced leases and immutable results
2503f17 fix: resolve active tenant membership and reject ambiguous organisation identities
aab4289 feat: bridge async backend calls to transactional Supabase repository operations
cb0e02a docs: record verified backend and evidence-layer integration boundaries
7c33482 merge: preserve backend and Supabase evidence implementations for integration
```
