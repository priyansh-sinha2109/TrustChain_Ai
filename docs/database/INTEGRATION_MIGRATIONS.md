# Integration migration coordination

Member 3's original migrations 00001–00003 and original commit history are preserved.
The integration branch adds only metadata and hardening around those procurement tables:

| Migration | Purpose |
| --- | --- |
| 00004 | Active membership and revocation-aware RLS helpers |
| 00005 | Persistent jobs, fenced leases, immutable snapshots and job references |
| 00006 | Private upload reservations and 10,000,000-byte bucket limit |
| 00007 | Reviewer-approved content hashes and immutable approval audit |
| 00008 | Actual provider status and optional provider-supplied finish timestamp |
| 00009 | Storage RLS binds canonical paths to actual cases and upload reservations |

All nine SQL files applied successfully to an isolated native PostgreSQL 18.6
database with minimal Supabase Auth/Storage schema stand-ins. This verifies SQL execution,
constraints and transaction behavior locally, not hosted Supabase policies or Storage.

Read-only inspection of the supplied Supabase project succeeded using its server key.
At inspection time, Storage returned zero buckets and REST exposed only integration_checks;
purchase_cases returned 404. Direct SQL inspection and migration history remain blocked
until DATABASE_URL is configured with the existing database password. API keys are not
database passwords. No hosted migration execution or schema reset has been performed.

Coordinate with the data owner before applying pending migrations. Check the actual
`supabase_migrations.schema_migrations` history and catalog first. Initial files contain
CREATE POLICY statements and must not be blindly replayed over existing manually created
policies. Do not infer migration application from committed files or an empty REST schema.
Never apply the benchmark seed to a shared project without a separate data decision.

Run from backend with the repository virtualenv:
`python -m scripts.verify_supabase`.
This is read-only and prints only schema/policy/bucket metadata. It reports local files
separately from real migration history. A zero exit requires actual schema and private
bucket checks; otherwise it fails explicitly. It never applies migrations automatically.
