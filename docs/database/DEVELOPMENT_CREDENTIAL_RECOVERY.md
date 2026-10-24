# Development credential recovery — 2026-10-24

Scope: approved development project `hrbsswqhrryshhiitxok` only. The user reported
an environment-file screenshot containing credentials; treat affected credentials
as exposed even though they are not tracked by Git.

## Completed

- Verified the existing Buyer and Reviewer UUIDs against Auth and their single active
  membership in `synthetic-trustchain-live-integration`.
- Confirmed only the existing Reviewer using the authorized Auth Admin API.
- Observed Reviewer password login fail with HTTP 400 / `invalid_credentials` after
  confirmation. Replaced both approved test-account passwords with independent strong
  random values through Auth Admin, and saved them only in ignored root `.env`.
- Both real password logins subsequently succeeded and returned the expected UUIDs.
- The token helper reports only allowlisted error codes, never provider response bodies.

## Provider rotation still required

The server service-role credential is an application credential, not a Supabase
Management API access token. No Management API token is configured. The available
TinyFish connector does not provide API-key administration. Do not claim these keys
were rotated simply because user passwords changed.

1. In this development project's Supabase Dashboard, replace the exposed privileged
   API credential and revoke/disable the old one. Follow the current migration guidance
   for legacy JWT-based anon/service-role keys; merely creating another key does not
   revoke a leaked legacy key. Update server `.env` and public frontend configuration
   together where necessary, then restart local processes and verify Auth/Storage.
2. Reset this development project's database password using its supported Dashboard
   control, then update the URL-encoded password in ignored `DATABASE_URL`. Do not
   modify database roles manually or print the resulting URI.
3. In TinyFish account administration, replace and revoke the exposed development API
   key, and update ignored `TINYFISH_API_KEY`. Do not start a chargeable run for rotation.
4. Revoke the approved users' old sessions. Existing access JWTs may remain usable until
   expiration even after refresh sessions are revoked; password rotation is not proof
   that all previously issued bearer tokens became immediately invalid.

The anon/publishable key is intentionally public; its visibility alone is not a
privileged-secret exposure. The service-role key, database password, TinyFish key,
user passwords and access/refresh tokens require incident handling.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[legacy key migration](https://supabase.com/kb/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd),
[sign-out and token expiry](https://supabase.com/docs/guides/auth/signout).
