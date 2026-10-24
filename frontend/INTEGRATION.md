# Connected workspace

Run the existing FastAPI server on port 8000 with the Supabase repository factory.
Copy `.env.example` to ignored `.env.local` and supply only the project's public URL
and anon key. Keep database, service-role and TinyFish credentials in the ignored
server environment. Restart/rebuild Next.js after changing public environment values.
The backend's FRONTEND_ORIGIN must match the browser origin (development: localhost:3000).

```powershell
npm ci --prefix frontend
npm --prefix frontend run dev
```

Sign in with a real Supabase account with active organisation membership. Create a
case, upload PDFs, and sign in as an authorised reviewer to approve the quote or PO.
Switch back to an authorised buyer/admin to start comparison. Job progress comes
from FastAPI polling; failures remain failures. Optional public research uses the
case's public supplier URL and the server's TinyFish configuration.

New confirmed users without a membership are routed to `/onboarding`. The explicit
setup action creates a separate buyer workspace. Organisation metadata is only an
editable name hint; it grants no tenant access or reviewer permission. Existing users
should use their administrator-assigned membership rather than create a second workspace.
Auth rate-limit responses show a safe status/code, explain email quota vs request limits,
and disable resubmission temporarily. There are no automatic signup/login retries.

Evidence and report pages load saved findings. Private source PDF previews use the
authenticated content endpoint. The downloaded PDF is a local snapshot of the saved
investigation and its review status, not a cloud-stored report or payment approval.
The built-in export font replaces non-ASCII characters; full Unicode report export
requires an embedded font. Previously recorded review comments are not exposed by
the existing read API, so the report states reviewed status without inventing details.

Only title, supplier and optional public URL are persisted on case creation.
Order values and commercial terms are extracted from the PDFs. The cases endpoint
does not supply aggregate job states; the dashboard deliberately leaves those totals
unavailable and links to each case. Status filter tabs are available only in demo mode.

Demo mode is an explicit `NEXT_PUBLIC_DEMO_MODE=true` build-time choice; it is never
enabled by an API or login failure. Live writes are rejected in that mode. Legacy
illustrative screens are retained for design reference and are not live evidence.

## Browser contract verification

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

Playwright starts an isolated production server on port 3107 and uses installed Chrome.
Every Auth, API and Storage request is intercepted; unrecognised external traffic is
blocked. The deliberately invalid synthetic session never reaches a real service.
These ten tests cover the browser contract, including rate limiting and onboarding, not hosted
Supabase authentication/persistence. Real workflow prerequisites are documented in
`../docs/database/LIVE_TOKEN_SETUP.md`. Real credentials must never be added to tests.

After the token helper succeeds and the real backend/frontend are running on ports
8000/3000, the separate `node frontend/scripts/live-workflow.mjs` command from the
repository root exercises real buyer/reviewer browser logins, uploads, approval,
investigation, source retrieval, review and PDF download. It requires the approved
test project's real email/password variables in ignored root `.env`, uses no mocks,
and logs only the failing stage or success. It does not start public research or
produce traces containing passwords. Its synthetic purchasing report stays in ignored tmp/.
