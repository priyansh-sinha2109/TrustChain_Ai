# Backend integration contract

Integration branch: `integration/backend-supabase`; draft delivery PR targets `Backend`.
The existing FastAPI implementation, Member 3's database layer and Member 2's frontend
are preserved. The hosted schema has ten applied migrations; authenticated live workflow
verification remains conditional on dedicated buyer/reviewer accounts.

## Execution milestones

1. FastAPI settings, safe errors, auth and shared models.
2. TinyFish async adapter and public URL safeguards.
3. Bounded PDF extraction and deterministic normalization.
4. Source-linked comparison and Decimal exposure calculation.
5. Authenticated orchestration routes, repository integration contract and workflow tests.

P0 owns the executable workflow. OCR and durable queue infrastructure are deferred.
The frontend exports a PDF snapshot of persisted findings; it is not a stored server report.
Each milestone is tested and committed before proceeding.

## Persistence boundary

The integration adapter implements `app.repository.Repository`. Configure
`REPOSITORY_FACTORY=app.supabase_adapter:create_repository`. It reuses Member 3's
SupabaseRepository and existing procurement tables with a transactional SQL bridge.
Missing configuration fails explicitly; test doubles are never wired into production.
All repository methods MUST authorize the verified user against organisation membership,
case ownership and role before accessing data, including job reads and document downloads.
Never trust caller-supplied organisation identifiers. Auth uses Supabase `/auth/v1/user`
to verify access tokens remotely; no unsigned JWT decoding.

The backend URL in development is `http://localhost:8000`; `/health` is liveness only.
Development Swagger is `/docs` and schema is `/openapi.json`.

## Foundation module guide

`backend/app/main.py` creates the FastAPI app; `config.py` loads server-only settings;
`security.py` verifies Bearer tokens with Supabase Auth. `models.py` is the shared
Pydantic contract and `repository.py` is the teammate adapter boundary.
`GET /api/v1/me` returns only the verified user ID. Missing tokens return 401;
unconfigured or unavailable authentication returns 503. Responses never echo token text.

From the repository root on Windows:

Use Python 3.11 or newer; this workspace was verified with Python 3.14.8.
`backend/requirements.lock` records the exact tested dependency versions.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m pytest -c backend/pytest.ini backend/tests -q
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000
```

Copy `backend/.env.example` to `backend/.env` and set the project URL and anon key.
The anon key contacts Auth. The integrated adapter also requires DATABASE_URL and
SUPABASE_SERVICE_ROLE_KEY for PostgreSQL transactions and real private Storage signing.
These values stay server-side. .env is ignored and is resolved relative to the project
root, independent of the shell's current directory. Use the root for all commands below.

## TinyFish module guide

`backend/app/tinyfish.py` implements server-side start, poll and normalization using
[the official Agent reference](https://docs.tinyfish.ai/agent-api/reference).
POST `/v1/automation/run-async` returns a run ID; GET `/v1/runs/{id}` retrieves state.
There is no user-supplied goal: only an approved public URL leaves the backend.
Provider payloads and errors are not passed verbatim to the frontend.

Set `TINYFISH_API_KEY` privately and run the root-level smoke command documented below.
The script prints real run state and validated source observations, never credentials.
Tests in `test_tinyfish.py` use mocked HTTP, not a live provider account.

URLs require HTTPS, an exact configured hostname, public DNS addresses, and no
credentials, query strings, fragments or custom ports. Supabase hosts are blocked.
Research is deliberately limited to the supplied page. Evidence from other URLs is
discarded. The remote browser owns redirects and DNS resolution: the local backend
cannot enforce network isolation inside TinyFish. The fixed goal forbids navigation,
but provider-level redirect/DNS enforcement remains an external dependency; do not
describe the allowlist as a complete provider-browser SSRF guarantee.

## Extraction module guide

`extraction.py` reads authorized bytes supplied by the repository, validates PDF magic,
MIME and exact size, and launches `pdf_worker.py` with a 20-second process timeout.
Limits: 10 MB, 40 pages, 50,000 characters per page, 200,000 total extracted characters.
The process isolates crashes/timeouts; OS-level memory quotas remain a deployment task.
Blank pages cause `OCR_REQUIRED`; corrupt/encrypted/over-limit PDFs fail explicitly.

`normalization.py` supports mm/cm/m, days/weeks, percentages, INR/USD/EUR/GBP,
Indian grouping, quantities and explicit freight included/excluded. Decimal values
remain strings in field records. Unsupported labels/units are never guessed.
Clean `Label: value` PDFs are the P0 format. Labelled part numbers start item sections;
repeated/conflicting values remain separate evidence. Complex tables, implicit item
associations and OCR are unsupported. Place `Part number` before item specifications.
Run `test_documents.py` for actual parser subprocess tests and normalization checks.

## Comparison and finance module guide

`comparison.py` accepts only approved quotes/orders as baseline and a separate final PI
in the same case. RFQs are traceability inputs, never accepted terms. It checks thickness,
grade, part number, quantity, total, advance percentage, delivery and freight. Exact
item identities scope technical comparisons. Missing, ambiguous and unsupported values
remain unresolved. Severity is deterministic: thickness/grade/part/advance conflicts
are HIGH, other conflicts or unresolved findings WARNING, matches INFO.

`financial.py` uses Decimal and rounds each advance to 2 decimals with ROUND_HALF_UP.
Each document uses its own total. Explicit advance amounts can be used without a
percentage; disagreement with a calculable advance is AMBIGUOUS. Missing currency,
missing values and currency mismatch produce no invented conversion or difference.
Run `test_comparison.py` and `test_financial.py`; all examples are synthetic.

## Frontend endpoints

All `/api/v1` routes require `Authorization: Bearer <Supabase access token>`.
Interactive models: `/docs`. Committed schema: `docs/backend-openapi.json`.

| Method | Path | Result |
| --- | --- | --- |
| GET | `/health` | Liveness only |
| GET | `/api/v1/me` | Verified user UUID |
| POST / GET | `/api/v1/cases` | Create / list authorized cases |
| GET | `/api/v1/cases/{case_id}` | Authorized case |
| POST | `/api/v1/cases/{case_id}/documents/upload-intents` | Signed private upload target |
| POST | `/api/v1/cases/{case_id}/documents/confirm` | Document registration |
| GET | `/api/v1/cases/{case_id}/documents` | Document metadata |
| POST | `/api/v1/cases/{case_id}/investigations` | 202 with job ID and poll URL |
| GET | `/api/v1/jobs/{job_id}` | Persisted job state |
| POST | `/api/v1/jobs/{job_id}/resume` | Resume queued/interrupted job |
| GET | `/api/v1/cases/{case_id}/findings` | Latest source-linked findings |
| GET | `/api/v1/cases/{case_id}/evidence` | Validated public observations |
| POST | `/api/v1/cases/{case_id}/reviews` | Human review decision |

Reports and OCR are deferred. No deployment URL has been provisioned.

Create case:
```json
{"title":"Panel purchase","supplier_name":"Supplier name","public_supplier_url":"https://approved-supplier.example"}
```

Upload intent:
```json
{"filename":"accepted-quote.pdf","document_type":"ACCEPTED_QUOTE","size_bytes":12345}
```
The adapter generates a private case-scoped upload URL. Upload using Member 3's
Storage contract, then confirm with `{"document_id":"<returned UUID>"}`. Confirmation
must verify object existence, magic/MIME, byte limits, immutable case association and
server-side approval authority. Client confirmation never grants baseline approval.

Start investigation with a required `Idempotency-Key` header:
```json
{"baseline_document_id":"<approved quote UUID>","final_document_id":"<PI UUID>","public_research":true}
```
Response: `{"job_id":"<UUID>","status":"QUEUED","poll_url":"/api/v1/jobs/<UUID>"}`.
Poll every 5 seconds until REVIEW_READY, PARTIAL_REVIEW or FAILED. A 202 acknowledges
only the persisted job. Retry lost responses with the same key; a different payload
using that key must return 409. Monetary JSON values are strings. Escape evidence text
in the frontend; never render it as HTML.

Review:
```json
{"job_id":"<UUID>","decision":"REQUEST_CLARIFICATION","comment":"Confirm changed terms."}
```
Allowed decisions: APPROVE, REQUEST_CLARIFICATION, REJECT. The data layer enforces
reviewer roles and atomically records user, time, case, job, decision and comment.

Errors: `{"error":{"code":"...","message":"...","request_id":"..."}}`.
401 UNAUTHENTICATED; 422 INVALID_INPUT / document errors; 409 idempotency/review conflict;
503 AUTH_UNAVAILABLE / PERSISTENCE_UNAVAILABLE. Job error codes include PROVIDER_AUTH,
PROVIDER_QUOTA, PROVIDER_RATE_LIMIT, PROVIDER_TIMEOUT, PUBLIC_RESEARCH_UNCONFIGURED,
PUBLIC_EVIDENCE_UNAVAILABLE and EXTRACTION_TIMEOUT. Provider failure preserves private
findings with PARTIAL_REVIEW and public NOT_CHECKED.

## Member 3 adapter requirements

The exact interface is `backend/app/repository.py`. The async factory accepts Settings.
Additional database secrets belong to Member 3's module; no table names are assumed.

- Every method authorizes verified user membership, case association and role.
  Raise safe AppError 403/404 for denied resources. Resolve organisation server-side.
- Document downloads return `(Document, bytes)` through private Storage, enforcing
  the 10 MB download limit before allocating unbounded content.
- `create_job` atomically enforces unique `(user, case, idempotency key)`, compares the
  immutable request fingerprint, and returns `(job, created)`. Avoid unprotected
  read-then-insert. Enforce active-investigation conflicts per case.
- `claim_job` uses database compare-and-swap and a processing lease of at least five
  minutes. Claim queued/expired jobs only; preserve stage and provider ID.
- `update_job` saves stage, provider ID, safe errors and timestamps. Enforce lease
  ownership and disallow terminal jobs moving backwards to PROCESSING.
- `save_results` saves immutable job-versioned fields, findings, evidence, exposure
  and audit events. For terminal results, atomically update job status and release
  its lease. Preserve history; latest-case reads must never mix investigations.
- Source fields include document ID/type, item, page and raw text. Save these alongside
  findings with supplier ID, case ID and timestamps. Persist TinyFish run IDs even on
  failure. captured_at is backend retrieval time; provider_finished_at is provider data.
- `save_review` verifies reviewer role and job/case association, appends an audit event,
  and atomically moves the job to REVIEWED. Human reviewers retain purchasing authority.

## Execution reliability

`investigation.py` runs BackgroundTasks with two processing slots per app process.
State is durable only with the real repository adapter; execution can stop on restart.
Resume uses the database lease and an existing provider run ID. PUBLIC_STARTING with
no provider ID becomes partial instead of blindly launching another paid run; operator
reconciliation is required. No scheduler or automatic restart recovery is implemented.
Use a durable worker for stronger delivery guarantees. Provider duration is requested
as 180 seconds; polling has a 200-second bound. Memory quotas remain a deployment task.

REVIEW_READY means processing finished, not that terms match or the supplier is verified.
Findings retain unresolved evidence states. Private text never enters a TinyFish payload.

## Validation and outstanding integration

Tests use synthetic PDFs, mocked HTTP/Auth and a test-only in-memory repository. They
cannot establish live Supabase persistence, RLS, reviewer roles, signed upload behavior
or live TinyFish success. Run the smoke command with a key and then verify the full
frontend-to-Supabase workflow against Member 3's adapter before marking integration ready.

## Integrated Supabase adapter (current implementation)

The adapter is implemented in `backend/app/supabase_adapter.py`; the earlier contract
requirements above are now implemented using the teammate's repository inside real SQL
transactions. Four bounded worker threads handle synchronous SQL/Storage calls. Each
operation resolves exactly one active database membership and verifies its role and
case organisation. Caller-supplied organisation/role values are never trusted. Missing,
revoked, unknown-role or multiple active memberships return 403. Reviewer/admin authority
is required for approvals and human decisions; buyer/admin authority is required for
case creation, upload and investigation processing.

Configure DATABASE_URL using Supabase Connect -> Session pooler and the existing database
password. The API service-role key is not a database password. Use a trusted backend-only
SQL login; it may bypass RLS, so explicit adapter authorization runs for every operation.
No code automatically applies migrations at startup. Follow the migration coordination
notes in `docs/database/INTEGRATION_MIGRATIONS.md`.

New additive endpoint:
`POST /api/v1/cases/{case_id}/documents/{document_id}/approval`
with `{"note":"Accepted purchasing baseline reviewed."}`. It returns the existing Document
shape with approved=true only after reviewer authorization, confirmed-object hash checking,
and immutable approval/audit insertion. Upload confirmation always returns approved=false
until this independent action occurs. Approval is not payment approval.

Signed upload URLs are produced by actual Supabase Storage requests, not constructed
placeholder tokens. Supabase gives uploads a fixed two-hour lifetime; send the raw PDF via
PUT to upload_url with Content-Type: application/pdf. The returned expires_at is the
reservation expiry. No apikey/service-role header is needed by the browser for this URL.
Confirmation verifies canonical association, object existence, streamed 10,000,000-byte
limit, exact reserved length, MIME, actual PDF parsing and SHA256 before registration.
Signed downloads are requested from Supabase for a 60-second read and never sent to TinyFish.
Bucket case-documents is private. Storage RLS additionally checks case existence and the
matching upload reservation; an org prefix alone does not authorize an arbitrary case path.

Document mapping: doc_type -> document_type, file_size -> size_bytes, mime_type ->
content_type; approved is derived from immutable document_approvals tied to the registered
SHA256. Cases join exactly one primary supplier via case_suppliers. INFO/WARNING/HIGH maps
to database LOW/MEDIUM/HIGH. Comparison status stays in findings.details.comparison_status;
database status OPEN is a separate human-review workflow. Unknown financial impact is SQL
NULL, not zero. Missing deal-version totals/percentages stay NULL, not Decimal zero.

Human decisions map APPROVE -> APPROVE_ADVANCE, REJECT -> REJECT_PAYMENT and
REQUEST_CLARIFICATION -> REQUEST_SUPPLIER_CLARIFICATION. Actual provider CANCELLED is
preserved in the job/provider metadata; Member 3's narrower research enum uses FAILED
for that terminal state. Provider finish times are populated only from provider data.
Job JSON adds nullable provider_status and provider_finished_at fields; existing fields
and route names are unchanged. Generated frontend DTOs: `docs/backend-api-types.ts`.
Regenerate OpenAPI from the app, then `python -m scripts.export_api_types` with PYTHONPATH=backend.
The OpenAPI error models now describe the actual safe error envelope, including 422.

Jobs are stored in investigation_jobs. Per-case SQL locks plus unique constraints make
idempotency atomic. Claiming sets a five-minute lease and unique fencing token; processing
stage updates renew the lease. Late writes from a replaced worker fail with LEASE_LOST.
Immutable provisional/terminal JSON snapshots retain a single job's complete response;
terminal snapshots, evidence, source claims, deal versions, findings, changes, exposure
and terminal job association commit in one PostgreSQL transaction. Replaying the identical
terminal result is safe; replacing it is rejected. Reviews and their audit events commit
with REVIEWED status. Findings responses retain the snapshot's processing status; poll the
job for its subsequent human-review status. BackgroundTasks still do not guarantee execution
across restarts. Explicit resume is supported after a lease expires; no scheduler is implied.

For root-level script commands in PowerShell, first set `$env:PYTHONPATH = 'backend'`, then
use `.\.venv\Scripts\python.exe -m scripts.verify_supabase` or
`.\.venv\Scripts\python.exe -m scripts.tinyfish_smoke`.
