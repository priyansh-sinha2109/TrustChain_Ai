# Backend integration contract

Branch: `Backend` (explicit current assignment). Repository audit: only README existed;
there are no teammate modules or migrations to reuse yet.

## Execution milestones

1. FastAPI settings, safe errors, auth and shared models.
2. TinyFish async adapter and public URL safeguards.
3. Bounded PDF extraction and deterministic normalization.
4. Source-linked comparison and Decimal exposure calculation.
5. Authenticated orchestration routes, repository integration contract and workflow tests.

P0 owns the executable workflow. P1 OCR, reports and durable queue infrastructure are deferred.
Each milestone is tested and committed before proceeding.

## Persistence boundary

Member 3 implements `app.repository.Repository` and an async factory configured through
`REPOSITORY_FACTORY=package.module:create_repository`. No database schemas are assumed.
Missing persistence returns 503; test doubles are never wired into production.
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
The anon key is used only to contact Auth; privileged server keys are not needed by
this backend contract. Member 3 owns private Storage access and database credentials.

## TinyFish module guide

`backend/app/tinyfish.py` implements server-side start, poll and normalization using
[the official Agent reference](https://docs.tinyfish.ai/agent-api/reference).
POST `/v1/automation/run-async` returns a run ID; GET `/v1/runs/{id}` retrieves state.
There is no user-supplied goal: only an approved public URL leaves the backend.
Provider payloads and errors are not passed verbatim to the frontend.

Set `TINYFISH_API_KEY` privately and run from `backend`: `python -m scripts.tinyfish_smoke`.
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
