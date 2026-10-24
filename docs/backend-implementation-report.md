# Backend implementation and handoff

## A. Actual implementation

FastAPI app, environment settings, narrow CORS, request IDs, sanitized errors, remote
Supabase Auth verification, Pydantic contracts and authenticated resource routes.
Routes delegate persistence to an explicit teammate-owned async adapter. PDF parsing,
normalization, comparison, exposure and investigation execution are executable services.
See `backend-api-contract.md` and `backend-openapi.json` for all endpoint schemas.

New implementation files live in `backend/app/`, synthetic tests in `backend/tests/`,
the controlled smoke command in `backend/scripts/`. README was updated; no frontend
files, database schema, migrations or production database were created.

## B. TinyFish integration

Official request contract verified against TinyFish's Agent API reference. Actual
httpx requests use POST `/v1/automation/run-async`, then GET `/v1/runs/{run_id}` with
server-only X-API-Key. Fixed public-only goals and structured observations preserve
run/source references. Credentials, private documents and commercial terms are excluded.

The smoke command was executed. Outcome: PUBLIC_RESEARCH_UNCONFIGURED. No TinyFish
key was present, so no live API call/run ID or supplier research success is claimed.
HTTP adapter tests used mocked responses. Remote-browser DNS/redirect isolation cannot
be guaranteed by local URL validation; approved hosts and page-only goals reduce scope.

## C. Document intelligence

Supports text-based PDFs with clean labelled fields, explicit part-number item sections,
exact page references and raw text. Extracts product, part, grade, thickness, dimensions,
quantity, units, unit price, total, currency, advance percent/amount, delivery, freight
and replacement policy when explicitly labelled. All extracted fields are returned for
versioned persistence. Limits: 10 MB, 40 pages, 200,000 text characters, 20-second parser
subprocess deadline. Scans require OCR; complex tables and implicit item matching are
unsupported. OS memory quotas are a deployment responsibility.

## D. Verification logic

Approved accepted quotation/purchase order versus final PI only; RFQ cannot act as an
accepted baseline. Technical checks: thickness, grade, part number, quantity. Commercial:
total, advance percent, delivery, freight. Explicit status/severity rules; incompatible
items or units and ambiguous evidence are unresolved, not invented conflicts.

Decimal advance = each document's total × its own percentage / 100. Round each advance
to two decimals with ROUND_HALF_UP, then subtract baseline from final. The synthetic
INR 480,000 at 30% versus 80% yields 144,000.00, 384,000.00 and 240,000.00 respectively.
Currency mismatch remains unresolved. Public observations do not verify company legitimacy.

## E. Supabase integration

`backend/app/repository.py` specifies Member 3's adapter. No existing Supabase layer was
present to integrate. Configure REPOSITORY_FACTORY, project URL and anon key privately.
Without configuration, persistence/auth fail explicitly. Case/org permissions, reviewer
roles, atomic idempotency, private uploads/downloads, processing leases, audit history
and transactionally saved terminal results must be implemented by Member 3.

Live Supabase persistence/RLS/Storage/authentication have not been tested. Workflow tests
use an in-memory adapter confined to the tests directory, never production wiring.

## F. API handoff

Development base: http://localhost:8000, Swagger `/docs`, schema `/openapi.json`.
See the adjacent contract for create/upload/start/poll/findings/evidence/review examples.
All resource routes require a verified Supabase Bearer token. Jobs return 202 and a poll
URL; private results survive public-research failure. In-process tasks can stop on restart;
lease-controlled explicit resume is available, not automatic durable execution.
Reports, OCR and a hosted deployment URL are deferred.

## G. Validation

Executed: pytest, pip check, compileall, live Uvicorn startup and local HTTP smoke checks.
The full suite passed 55 tests, and the final model/schema update passed all 10 targeted
workflow tests. One upstream Starlette warning
reports deprecated httpx TestClient support. Local HTTP: health 200, Swagger 200, OpenAPI
available, unauthenticated cases 401. Tests cover actual synthetic PDF parsing, calculations,
mocked provider/Auth errors, idempotency, partial results, uncertain starts and API schemas.
No live cloud integration is represented as tested.

## H. Git

Assigned branch: Backend. GitHub connector confirmed admin/push access, and the local Git
push dry-run succeeded. Each milestone was tested and committed before the next began:

- 6c8d4f7: FastAPI contracts and Supabase authentication boundary.
- 241c4ea: TinyFish async research and public URL safeguards.
- 9f63eb6: Bounded PDF extraction, page references and unit normalization.
- a22667c: Approved purchasing comparisons and Decimal exposure calculations.
- Final workflow commit: see `git log`; contains routes, orchestration, tests and handoff.

The branch can be shared for teammate integration, but live dependencies must be verified
before calling it production/integration ready. No changes are pushed directly to main.

## I. Remaining dependencies

Member 3's adapter and live integration credentials; configured TinyFish key and real smoke
run; frontend integration; durable execution and provider isolation where required;
deployment destination/configuration. Report generation and OCR remain P1.
