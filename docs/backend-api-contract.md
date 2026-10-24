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
