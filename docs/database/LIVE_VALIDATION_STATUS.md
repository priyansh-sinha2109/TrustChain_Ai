# Live configuration and hosted verification

See [AUTH_INTEGRATION_STATUS.md](AUTH_INTEGRATION_STATUS.md) for the subsequent approved
test-organisation setup, account confirmation requirements and current test counts.

Date: 24 October 2026. This supersedes the earlier hosted-blocker snapshot in integration-report.md.

- Real credentials were found in the locally edited examples, preserved in ignored .env
  and an ignored recovery file, then removed from both example files. Supplied credential
  types were absent from the relevant local/remote Git history and staging area.
- Existing working .env entries were retained. Missing values were merged. The session-pooler
  URI was safely encoded without double-encoding existing escapes and requires SSL.
- The actual project matches the configured Supabase URL. PostgreSQL 17.11 connectivity
  and client-to-pooler TLS were verified without displaying a credential URI.
- Initial read-only inspection found only the unrelated integration_checks table, no app
  objects/history, and no buckets. The exact ten-file plan and manifest were prepared.
- The user explicitly approved those migrations. Supabase CLI 2.122.0 previewed and applied
  all ten, without seed import or reset. Actual hosted history now records 00001 through 00010.
- Follow-up SQL inspection found all 19 expected tables, RLS enabled and no missing named
  policies. Both Storage buckets are private; case-documents is PDF-only at 10,000,000 bytes,
  and case-reports allows PDF/JSON at 20 MiB. The unrelated table was preserved.
- One actual TinyFish smoke against https://example.com returned a real run ID, polled to
  COMPLETED and returned a source-backed page-title/visible-sentence observation. No private
  purchasing data was supplied and no additional paid smoke run is required.
  Run ID: `cefc92db-5fd5-4f24-ad39-b8f350f3c66d`; provider finish time: `2026-10-24T13:15:19Z`.
- Regression: 104 passed, 2 live tests skipped, 0 failed. All ten migrations also passed on
  a fresh isolated local PostgreSQL database. pip check and compileall passed.

Pending: actual buyer/reviewer tokens, active test memberships and deliberate test-project
opt-in. Authenticated hosted workflow and synthetic Storage upload/download remain NOT TESTED.
The user is configuring real test tokens. See LIVE_TOKEN_SETUP.md for exact prerequisites.
No service-role key is treated as a buyer token, and no fake token is generated.

Current verdict: INTEGRATION NOT READY until the authenticated hosted workflow passes.
