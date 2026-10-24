# Backend and evidence-layer integration audit

Integration branch: `integration/backend-supabase`, reused with its existing merge in
progress. Merge parents are Backend `d0c1aa4` and data layer `a513079`. Only README and
gitignore needed conflict resolution. Original history and both implementations remain.
Baseline validation: 73 existing tests passed (55 backend + 18 database).

## Verified interfaces and gaps

Backend Repository is async, keyed by verified user UUID; Member 3's repository is sync
and takes TenantSecurityContext. Existing case/supplier/document/evidence methods will
be reused through a transactional client. A bounded thread bridge prevents event-loop
blocking. The comparison engine and frontend route names remain unchanged.

Member 3 schema has organization_members, purchase_cases, suppliers, case_suppliers,
documents, deal_versions, public_research_runs, evidence_sources, claims, findings,
deal_changes, review_decisions and append-only audit_events. No duplicate procurement
tables are needed. Additive integration metadata will cover jobs, leases, immutable
snapshots, upload reservations and explicit document approval.

StorageService currently constructs unsigned/placeholder URLs. SupabaseRestClient and
SupabaseRepository silently fall back when unconfigured. Production paths must fail
explicitly; only tests may opt into memory. Existing tests remain intact.

Backend statuses describe evidence; database finding status describes review workflow.
They must remain separate. Backend severity INFO/WARNING/HIGH maps to LOW/MEDIUM/HIGH.
Purchase approval is a reviewer action, independent of upload confirmation.

## Delivery sequence

Commit the compatibility adapter, verified membership resolution, atomic job migration,
real private Storage signing, auditable baseline approval, explicit mappings, transactional
evidence persistence, migration checks, integration tests and API handoff as tested units.
Use direct PostgreSQL transactions for multi-table writes; no REST batch is called atomic.

Live environment audit: no .env, backend/.env, Supabase config or relevant process
environment variables were present. No hosted migration application is claimed.
Live tests require a dedicated Supabase project and explicit test-user configuration.
No shared database reset, frontend changes or merge into Backend/main is authorized.
