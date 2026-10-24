# Full-stack integration status — 24 October 2026

Later authentication/onboarding work and current live-test prerequisites are recorded
in [AUTH_INTEGRATION_STATUS.md](database/AUTH_INTEGRATION_STATUS.md). Counts and membership
state below describe this earlier frontend-integration snapshot.

**Verdict: INTEGRATION NOT READY.** The connected implementation and automated checks
are prepared, but the authenticated hosted purchasing workflow has not run.

## Git integration and duplicate-work audit

Current and delivery branch: `integration/backend-supabase`.
Frontend source: `Frontend` at `fd1568f38d1f2d84ae67a62d9e183eea27933441`.
Its merge base was the already completed integration commit `3a83d5b`.
The source diff contained only `frontend/` and `ui image/`; there were no new backend
or database changes to exclude. Completed backend/database code was therefore not
integrated twice. No migration was added or replayed during this frontend integration.

Normal merge commit: `9074121`; original Member 2 commits `7941d84`, `a827d56`,
`ca78448`, `e488418`, `fd1568f` remain reachable. Integration fixes: `387bed5`.
Additional verification/fix and documentation commits are listed in the delivery's Git log.
No squash, force-push, history rewrite, default-branch change or deployment was performed.
Neither `Backend` nor `main` was merged automatically.

- Frontend integration review: https://github.com/priyansh-sinha2109/TrustChain_Ai/pull/3
- Draft delivery into Backend: https://github.com/priyansh-sinha2109/TrustChain_Ai/pull/2

## Connected behavior

Login errors remain errors. Protected requests send the real Supabase access token.
Case creation sends only supported fields. Signed private uploads must succeed before
confirmation; document IDs come from the backend. Quote/PO approval is a separate
reviewer-authorised action. Starting an investigation uses those confirmed document
IDs and a retry-stable idempotency key. Progress polls persistent job state and refuses
to display another job's result version. Failed jobs do not simulate completion.

Findings, advance exposure, source references and public observations come from the
saved investigation. Review errors never display a recorded decision. Report export
downloads a real PDF snapshot of saved findings and review status. Source previews use
a new authorised, no-store PDF content route; existing routes remain stable.

The existing repository adapter, procurement schema, tenant checks, persistent jobs,
transactional result save, PDF extraction, comparison and TinyFish integration were reused.
No second adapter, schema or comparison engine was created. Frontend live mode never
falls back to sample data. Illustrative design screens require an explicit demo build.

## Verification boundaries

| Check | Actual result |
| --- | --- |
| Environment configuration | READY for database/Storage/TinyFish; dedicated live-user setup MISSING |
| Secret audit | SAFE in inspected tracked files, staged diff and relevant environment-file history; no configured credential matches |
| Hosted PostgreSQL | CONNECTED with TLS; read-only audit passed again |
| Hosted migrations | APPLIED: all ten versions recorded; 19 expected tables; no missing named policies or disabled expected-table RLS |
| Storage bucket configuration | VERIFIED: both buckets private; documents PDF-only, 10,000,000 bytes |
| Real signed upload/download object workflow | NOT VERIFIED; no authenticated synthetic object test performed |
| Supabase user authentication/tenant workflow | BLOCKED by missing dedicated-project opt-in and buyer/reviewer tokens |
| TinyFish | Previous controlled LIVE SUCCESS; not repeated or charged again in this frontend task |
| Python regression | 105 passed, 0 failed, 2 live tests skipped |
| Isolated local SQL | All ten migrations and database tests passed using native PostgreSQL with minimal local Auth/Storage stand-ins |
| Python consistency | pip check and compileall passed |
| Frontend checks | ESLint, TypeScript in production build and Next.js production build passed |
| Browser contract tests | 6 passed, 0 failed; every Auth/API/Storage request mocked and external traffic blocked |
| Full hosted end-to-end workflow | NOT TESTED |

The browser tests cover case creation, upload/confirmation, baseline approval, real-ID
investigation requests, polling, findings/exposure display, denied and successful review
responses, evidence and PDF download. Negative checks cover invalid login, API outage,
failed jobs, failed private uploads and mismatched result versions. Fixtures are labelled
SYNTHETIC and make no supplier claims. A report-page screenshot was visually inspected.
Mock sessions are deliberately invalid and never sent to a real service.

Previous real TinyFish run: `cefc92db-5fd5-4f24-ad39-b8f350f3c66d`, completed at
`2026-10-24T13:15:19Z` against example.com. This proves provider connectivity, not the
current hosted purchasing workflow. See database/LIVE_VALIDATION_STATUS.md.

## Remaining work and practical limits

Configure `TRUSTCHAIN_LIVE_TESTS=1`, the deliberately designated test project reference,
and real buyer/reviewer access tokens in ignored `.env`. Both users need active,
unambiguous memberships with appropriate roles. Follow database/LIVE_TOKEN_SETUP.md,
then run the opt-in hosted test and exercise the browser against those real accounts.
No service-role key can substitute for an end-user access token.

PDF export currently uses a built-in ASCII font and replaces unsupported characters.
It records reviewed status but cannot display historical review comments because the
current API has no review-read endpoint. Reports are downloaded locally, not stored
in case-reports. Aggregate job states are not in the cases response; dashboard totals
and list status filters do not invent them. BackgroundTasks still does not guarantee
automatic durable execution; interrupted jobs use the existing resume/lease mechanism.

The Python suite emits the existing Starlette/httpx deprecation warning. There are no
failing checks hidden by test changes. Hosted Auth and Storage execution remain required
before declaring the application integrated or making the delivery PR ready to merge.

## Contributor attribution

GitHub's commit API associates the inspected original commits with all three accounts:
Anjali Singh (`anjalisgh-10`, `a513079`), Gaurav Tiwari (`Gaurav-devv`, `fd1568f`),
and Priyansh (`priyansh-sinha2109`, `d0c1aa4`). The default main branch still contains
only the initial commit. GitHub documents that commits outside the default branch do
not count in its contributors graph. Existing attribution was preserved; no fake
commit or author rewrite was needed. Email verification status was not inferred.

Reference: https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors

## Exact file manifest

The following manifest compares this frontend integration with the previously delivered
integration snapshot `3a83d5b`. `A` means added and `M` modified. It includes original
Member 2 UI assets and subsequent integration changes; generated artifacts and secrets
are excluded.

```text
M backend/app/routes.py
M backend/tests/test_investigations.py
M docs/backend-api-contract.md
M docs/backend-openapi.json
A docs/full-stack-integration-report.md
A frontend/.env.example
A frontend/.gitignore
A frontend/AGENTS.md
A frontend/INTEGRATION.md
A frontend/README.md
A frontend/e2e/workflow.spec.ts
A frontend/eslint.config.mjs
A frontend/next.config.ts
A frontend/package-lock.json
A frontend/package.json
A frontend/playwright.config.ts
A frontend/postcss.config.mjs
A frontend/public/file.svg
A frontend/public/globe.svg
A frontend/public/next.svg
A frontend/public/vercel.svg
A frontend/public/window.svg
A frontend/src/app/auth/page.tsx
A frontend/src/app/cases/[id]/documents/page.tsx
A frontend/src/app/cases/[id]/evidence/page.tsx
A frontend/src/app/cases/[id]/findings/page.tsx
A frontend/src/app/cases/[id]/progress/page.tsx
A frontend/src/app/cases/[id]/reports/page.tsx
A frontend/src/app/cases/[id]/review/page.tsx
A frontend/src/app/cases/new/page.tsx
A frontend/src/app/cases/page.tsx
A frontend/src/app/dashboard/page.tsx
A frontend/src/app/favicon.ico
A frontend/src/app/globals.css
A frontend/src/app/help/page.tsx
A frontend/src/app/layout.tsx
A frontend/src/app/page.tsx
A frontend/src/components/ui/AppShell.tsx
A frontend/src/components/ui/Badge.tsx
A frontend/src/components/ui/EvidenceDrawer.tsx
A frontend/src/components/ui/ExposureCard.tsx
A frontend/src/components/ui/LiveCaseWorkspace.tsx
A frontend/src/components/ui/Logo.tsx
A frontend/src/components/ui/StatCard.tsx
A frontend/src/components/ui/SyntheticBanner.tsx
A frontend/src/lib/api.ts
A frontend/src/lib/mockData.ts
A frontend/src/lib/supabase.ts
A frontend/src/types/api.ts
A frontend/tsconfig.json
A ui image/Dashboard · Desktop 1440.png
A ui image/Dashboard · Laptop 1280.png
A ui image/Dashboard · Mobile 320.png
A ui image/Dashboard · Mobile 390.png
A ui image/Dashboard · Tablet 834.png
A ui image/Document Upload · Desktop 1440.png
A ui image/Document Upload · Laptop 1280.png
A ui image/Document Upload · Mobile 320.png
A ui image/Document Upload · Mobile 390.png
A ui image/Document Upload · Tablet 834.png
A ui image/Evidence Explorer · Desktop 1440.png
A ui image/Evidence Explorer · Laptop 1280.png
A ui image/Evidence Explorer · Mobile 320.png
A ui image/Evidence Explorer · Mobile 390.png
A ui image/Evidence Explorer · Tablet 834.png
A ui image/Help · Desktop 1440.png
A ui image/Help · Laptop 1280.png
A ui image/Help · Mobile 320.png
A ui image/Help · Mobile 390.png
A ui image/Help · Tablet 834.png
A ui image/Human Review · Desktop 1440.png
A ui image/Human Review · Laptop 1280.png
A ui image/Human Review · Mobile 320.png
A ui image/Human Review · Mobile 390.png
A ui image/Human Review · Tablet 834.png
A ui image/Investigation Progress · Desktop 1440.png
A ui image/Investigation Progress · Laptop 1280.png
A ui image/Investigation Progress · Mobile 320.png
A ui image/Investigation Progress · Mobile 390.png
A ui image/Investigation Progress · Tablet 834.png
A ui image/Investigations · Desktop 1440.png
A ui image/Investigations · Laptop 1280.png
A ui image/Investigations · Mobile 320.png
A ui image/Investigations · Mobile 390.png
A ui image/Investigations · Tablet 834.png
A ui image/Landing Page · Desktop 1440.png
A ui image/Landing Page · Laptop 1280.png
A ui image/Landing Page · Mobile 320.png
A ui image/Landing Page · Mobile 390.png
A ui image/Landing Page · Tablet 834.png
A ui image/Login & Signup · Desktop 1440.png
A ui image/Login & Signup · Laptop 1280.png
A ui image/Login & Signup · Mobile 320.png
A ui image/Login & Signup · Mobile 390.png
A ui image/Login & Signup · Tablet 834.png
A ui image/New Investigation · Desktop 1440.png
A ui image/New Investigation · Laptop 1280.png
A ui image/New Investigation · Mobile 320.png
A ui image/New Investigation · Mobile 390.png
A ui image/New Investigation · Tablet 834.png
A ui image/Reports · Desktop 1440.png
A ui image/Reports · Laptop 1280.png
A ui image/Reports · Mobile 320.png
A ui image/Reports · Mobile 390.png
A ui image/Reports · Tablet 834.png
A ui image/TrustChain UI kit · Reusable controls.png
A ui image/Verification Results · Desktop 1440.png
A ui image/Verification Results · Laptop 1280.png
A ui image/Verification Results · Mobile 320.png
A ui image/Verification Results · Mobile 390.png
A ui image/Verification Results · Tablet 834.png
```
