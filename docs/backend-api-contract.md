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
