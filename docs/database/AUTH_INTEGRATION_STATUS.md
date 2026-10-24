# Authentication and live-integration follow-up

Date: 24 October 2026. Branch: `integration/backend-supabase`.
This supersedes the membership/setup blockers in the earlier integration snapshots.

**INTEGRATION NOT READY:** reviewer confirmation and real test-account credentials
are still required before genuine Auth/Storage/browser verification can complete.

## Diagnosis and safe fixes

Read-only Dashboard inspection confirmed built-in email delivery, custom SMTP disabled,
and a project email limit of 2/hour. The signup/signin IP limit is separately 30 requests
per five minutes. Public Auth settings returned HTTP 200: email enabled, signup enabled,
and mailer_autoconfirm=false. Site URL is http://localhost:3000 with no redirect allowlist.
The reported `email rate limit exceeded` message strongly indicates the project email
quota. The original request's HTTP status/code and provider request logs were not
captured, so this is not a claim that every possible IP limit was excluded. No new
signup email was sent merely to reproduce the error. Browser control later reported
user-interaction conflicts; raw request logs were not extracted.

The frontend now separately handles over_email_send_rate_limit, over_request_rate_limit
and generic HTTP 429. It displays only safe HTTP/recognised-code diagnostics, explains
the email quota, and temporarily disables submissions. A synchronous in-flight guard
prevents duplicate requests even before React rerenders. Failed requests clear previous
success messages. No automatic Auth retries or synthetic success were added.

The project administrator must configure an approved custom SMTP provider and verify
its sender/domain. Keep production email confirmation enabled. Add the exact development
redirect http://localhost:3000/auth; production must use approved actual HTTPS origins.
No project Auth setting was changed in this task.

Sources: [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[admin email confirmation](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

## Actual hosted setup

Project ref `hrbsswqhrryshhiitxok` matches the configured URL. Before setup, every one
of the 20 public tables and Storage objects was empty, with no additional application
schemas. The user explicitly designated this project for development/testing.

Created once, using existing constraints and no DDL:

- Organisation `91727cc6-86f8-43d6-9810-56e6ab532254`, slug
  `synthetic-trustchain-live-integration`, labelled SYNTHETIC DEVELOPMENT TEST.
- Buyer `731183c8-e092-41ef-bd4e-d925fe6ac9ff`: active buyer membership, email confirmed.
- Reviewer `2434799b-76bf-4bcd-881c-3913a6c2bfa9`: active reviewer membership, email
  unconfirmed at last inspection. The user will confirm this specific account.

No duplicate organisation or membership was created. Assignment audit entries were
recorded, with an append-only attribution note clarifying that target account IDs in
the assignment records are subjects, not authenticated operators. The note uses the
explicit nil-UUID system-maintenance principal. No audit history was modified/deleted.

Actual hosted SQL RLS checks with authenticated role and the configured UUID claims
showed one visible test organisation and the two intended membership roles. These
claims were declared for SQL testing; they do not prove a real Auth login. Hosted
schema/bucket audit still passes: ten migrations applied, expected tables/RLS/policies
present, private buckets configured. No migration was replayed or RLS disabled.

## Secure onboarding

Signup metadata had no provisioning effect: there were no organisation/member rows
and no auth.users provisioning trigger. The new explicit `/onboarding` screen calls
an authenticated backend endpoint after email confirmation. It creates a separate
buyer workspace with a random unique slug; names never join an existing tenant.
Client-supplied roles and org IDs are rejected. Existing roles remain unchanged;
inactive and ambiguous membership cannot be bypassed. Per-user transaction locking
ensures concurrent requests create one organisation/member/audit result. Reviewer
assignment remains an authorised administrative operation.

## Verification

- Python regression: 116 passed, 0 failed, 2 live tests skipped. Includes six new real
  isolated-PostgreSQL onboarding tests and five mocked setup/billing-safety tests.
- Browser contract suite: 10 passed, 0 failed. Auth, API and Storage are mocked and
  external traffic blocked; includes all three rate-limit cases and buyer onboarding.
- Production build, ESLint and standalone TypeScript passed after narrowing the form
  element type in the new double-submit test. pip check and compileall passed.
- Ten migrations passed on a fresh isolated local database, with local Auth/Storage
  stand-ins. Existing cross-tenant and reviewer/buyer tests remain intact.
- Explicit hosted workflow invocation: 1 skipped because both access tokens are absent.
  The helper refused to attempt login while an account email was unconfirmed.
- Real signed object upload/download, hosted Auth sessions, live investigation and
  complete browser workflow: NOT TESTED. No successful result is claimed.
- No new TinyFish run. Its live test now requires the separate
  TRUSTCHAIN_LIVE_TINYFISH=1 flag, which remains unset. The previous successful provider
  smoke remains historical evidence only.

## Next operator steps

Follow [LIVE_TOKEN_SETUP.md](LIVE_TOKEN_SETUP.md). Confirm the reviewer email through
its inbox or the explicit, account-specific authorised admin helper. Add existing
passwords privately to ignored root `.env` as TRUSTCHAIN_TEST_BUYER_PASSWORD and
TRUSTCHAIN_TEST_REVIEWER_PASSWORD. The setup helper can alternatively prompt secretly.
It validates the project, account UUIDs, confirmed emails and roles before signing in
once per user, then stores real access tokens/account emails without printing them.

Run `python -m scripts.configure_live_tokens` with PYTHONPATH=backend, then the documented
authenticated Supabase pytest selection. With the real backend on port 8000 and frontend
on 3000, run `node frontend/scripts/live-workflow.mjs`. That script uses actual browser
password logins and real APIs/Storage, disables public research, checks three uploaded
PDFs, approval, processing, saved exposure, source retrieval, review and downloaded PDF.
It produces no traces or raw provider/error output containing credentials. It is
prepared but cannot be claimed to pass until the account setup is complete.

Remaining product limits: reviewer/admin assignment is administrative; PDF export uses
an ASCII font and does not fetch historical review comments or store a cloud report.
BackgroundTasks is not an automatic durable worker. PR #2 remains draft; no production
deployment, main/Backend merge, history rewrite or force-push occurred.
