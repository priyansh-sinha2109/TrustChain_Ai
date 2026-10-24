# Hosted migration application plan — approval required

Target: the Supabase project already configured in the ignored root `.env`.
The session-pooler user/project suffix matches SUPABASE_URL. Client-to-pooler TLS is
verified. PostgreSQL 17.11 accepts the database credentials.

## Read-only preflight findings

- The only public table is `integration_checks`; it must remain untouched.
- None of the 19 expected procurement/integration tables exists.
- No public functions, public triggers or Storage object policies conflict with this app.
- `supabase_migrations.schema_migrations` does not exist; all ten app migrations are pending.
- Both required UUID/crypto extensions and the anon/authenticated/service_role roles exist.
- Storage buckets are empty. Storage already enables RLS and owns its objects table.

Migration 00003 was corrected locally to skip its redundant provider-owned table ALTER
when RLS is already enabled. It still enables RLS in a locally owned test schema if needed.
No hosted SQL has been changed by this preflight.

## Exact proposed application

1. Recheck the target and the above object/history inventory immediately before execution.
   Stop if unexpected app tables, conflicting policies/functions or migration history appear.
2. Use the official Supabase CLI `db push` with the configured session-pooler connection,
   supplying credentials only through an in-memory subprocess argument. Capture and redact
   CLI output before displaying it. Do not print the command with the credential URI.
3. Apply the ten files below in version order, recording the standard Supabase migration
   history. Each migration is transactional; stop on the first error and inspect the real
   state before retrying. Do not blindly replay a partly applied history.
4. Create the 19 app tables and their functions, indexes, triggers, foreign keys and RLS.
   Create private `case-documents` (10,000,000 bytes, PDF) and `case-reports` (20 MiB, PDF/JSON).
   Add only the named app Storage policies and database permissions defined in those files.
5. Rerun the read-only SQL/Storage audit and verify history, expected objects, policies,
   private bucket flags, limits and MIME allowlists.

No reset, seed import, unrelated table/data modification, auth-account creation, test
fixture insertion, payment action or PR merge is included in this approval.

## Ordered files

1. `20261024000001_core_procurement_schema.sql`
2. `20261024000002_evidence_and_usp_layer.sql`
3. `20261024000003_storage_policies.sql`
4. `20261024000004_active_memberships.sql`
5. `20261024000005_persistent_investigations.sql`
6. `20261024000006_private_upload_reservations.sql`
7. `20261024000007_document_approvals.sql`
8. `20261024000008_provider_state.sql`
9. `20261024000009_storage_case_associations.sql`
10. `20261024000010_currency_and_rounding.sql`

The accompanying `hosted-migration-manifest.json` records the exact file hashes reviewed
for this proposal. Application must refuse a changed manifest until reviewed again.

## Separate live-test prerequisites

After schema verification, use a dedicated test project and actual buyer/reviewer users.
Set TRUSTCHAIN_LIVE_TESTS=1 and TRUSTCHAIN_TEST_PROJECT_REF deliberately; supply their real
Supabase access tokens and create active memberships in one test organisation. Service-role
credentials are not user tokens. These accounts/permissions and test writes are not silently
created by the migration plan. The controlled TinyFish smoke test has already succeeded and
must not be repeated by the regression run.
