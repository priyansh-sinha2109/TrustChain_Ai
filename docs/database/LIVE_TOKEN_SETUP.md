# Real buyer/reviewer test setup

Use a dedicated, approved test project. Do not use production purchasing records.
The migration approval did not create Auth accounts, organisation memberships or test data.

1. In Supabase Authentication -> Users, create or select two actual test accounts. One is
   the buyer and one is the reviewer. Use their Auth user UUIDs, not API-key identifiers.
2. An authorised project administrator creates one clearly labelled test organisation in
   public.organizations, then public.organization_members rows for those UUIDs with roles
   buyer and reviewer. Both memberships must be active. Use separate test users if an
   existing user already has another active organisation; the adapter rejects ambiguity.
3. Sign in each account through the frontend's Supabase login or the Supabase Auth SDK:
   `supabase.auth.signInWithPassword({email, password})`. The SDK must use the project URL
   and anon key, not the service-role key. Copy the resulting session.access_token privately
   into ignored .env. It is not the refresh token or the service-role key.
4. Configure these entries only in ignored .env:

```dotenv
TRUSTCHAIN_LIVE_TESTS=1
TRUSTCHAIN_TEST_PROJECT_REF=<the designated test project ref>
TRUSTCHAIN_TEST_BUYER_ACCESS_TOKEN=<real buyer session access token>
TRUSTCHAIN_TEST_REVIEWER_ACCESS_TOKEN=<real reviewer session access token>
```

DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are already
required by the adapter. Project ref must match SUPABASE_URL. Refresh expired tokens
through a real sign-in; do not edit JWT claims or use an API key as a user identity.

From the repository root, run only the authenticated test after configuration:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests/test_live_supabase.py::test_authenticated_live_supabase_workflow -q
```

It creates clearly labelled synthetic purchasing data, uploads synthetic PDFs, approves
the baseline as the reviewer, compares documents, persists findings and records a request
for clarification. It does not delete audit history. Do not enable it on a shared production
project. The separate TinyFish smoke already succeeded; selecting only this test avoids
starting another paid research run.

## Approved development project and existing users

The user designated `hrbsswqhrryshhiitxok` for development/testing. Before setup, all
20 public tables (including integration_checks), Storage objects and additional
application schemas were empty. Two Auth users existed. No production purchasing
records were found, and no migrations were replayed.

The following idempotent setup has now been applied:

| Record | Value |
| --- | --- |
| Organisation UUID | `91727cc6-86f8-43d6-9810-56e6ab532254` |
| Name | SYNTHETIC DEVELOPMENT TEST - TrustChain integration |
| Slug | synthetic-trustchain-live-integration |
| Buyer UUID | `731183c8-e092-41ef-bd4e-d925fe6ac9ff` |
| Reviewer UUID | `2434799b-76bf-4bcd-881c-3913a6c2bfa9` |

Both memberships are active and auditable, with separate buyer/reviewer roles.
The buyer email was confirmed; the reviewer email was still unconfirmed at inspection.
Hosted SQL checks using authenticated role/actual user UUID claims saw one organisation
and the two intended memberships. These are RLS checks, not end-user Auth login evidence.

The reviewer should follow its confirmation email, or an authorised administrator can
confirm **only that approved development account**, leaving project confirmation enabled.
The official [Auth Admin update API](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid)
supports `email_confirm: true`. The following explicit server-side helper is an alternative
when the Dashboard does not expose that action; it does not run automatically:

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m scripts.configure_live_tokens --confirm-reviewer
```

Only use that command after verifying the approved test account belongs to the team.
No password is reset or generated. Never use account-specific admin confirmation as a
replacement for production users proving ownership of their mailboxes.

Privately add the two existing passwords to ignored root `.env` as
`TRUSTCHAIN_TEST_BUYER_PASSWORD` and `TRUSTCHAIN_TEST_REVIEWER_PASSWORD`. Use dotenv
quoting if passwords contain spaces or special characters; never paste them into chat
or `.env.example`. Alternatively the helper accepts hidden interactive prompts.

```powershell
$env:PYTHONPATH = 'backend'
.\.venv\Scripts\python.exe -m scripts.configure_live_tokens
```

It validates the intended project, approved UUIDs, active roles and shared test tenant,
requires both emails confirmed, signs in once per account using the public anon key,
and checks returned user UUIDs before storing access tokens and account emails in the
ignored root `.env`. It never logs passwords, access/refresh tokens or provider bodies.
It writes no partial token update if the second sign-in fails and performs no retries.

The chargeable provider test now additionally requires `TRUSTCHAIN_LIVE_TINYFISH=1`.
Leave that unset; enabling Supabase tests alone cannot start another TinyFish smoke.

## Email service settings requiring project administration

Observed: Email provider enabled, signup enabled, Confirm Email enabled; custom SMTP
disabled. Site URL is http://localhost:3000 and the redirect allowlist is empty.
Add the exact development confirmation return URL `http://localhost:3000/auth` in
Authentication → URL Configuration. Add actual approved HTTPS production URLs only
when configuring production. This code requests `/auth` as emailRedirectTo.

Configure an approved custom SMTP provider in Authentication → Emails → SMTP Settings
and verify sender-domain ownership/deliverability. The built-in service is currently
limited to two emails per hour per project, independently of the observed 30 signup/
signin requests per five-minute IP window. SMTP credentials remain Dashboard/server
secrets. Keep production email confirmation on. Confirmed development users can log
in without sending signup emails; this does not bypass Auth request limits.

Sources: [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
