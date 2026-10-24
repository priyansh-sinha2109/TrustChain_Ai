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
