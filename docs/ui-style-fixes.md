# UI style fixes — 25 October 2026

## Confirmed findings

- The running site's stylesheet loaded successfully; CSS was not globally missing.
- Shared button classes were outside Tailwind's cascade layers. Their padding,
  typography and radius therefore overrode page utility classes, including the
  landing page's rounded login button. Shared controls now use the components layer.
- Mobile authentication displayed the full marketing panel ahead of the form.
  The panel is compact on smaller screens; the desktop presentation is preserved.
- The checkout was `integration/backend-supabase` at `bf9cc77`, while the running
  server still displayed text from another build. Work stayed on the current
  branch, and the app server was restarted with the newly verified build.
- The generated `.next-verify` directory was being scanned by ESLint. Alternate
  Next build directories are now ignored by lint and Git. Tailwind scans only src.

## Changes

Consistent form controls, case navigation with an active state, source cards,
wrapping exposure amounts, responsive tables and form actions, sidebar sizing,
long identity wrapping, accessible mobile-menu controls, a skip link, input labels
and autocomplete, loading and empty table states, reduced-motion support, and a
public URL input inside the case form. Existing authentication and API behavior
were preserved; no backend or hosted database changes were made.

## Verification

- `npm run lint`: passed after excluding generated build output.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: 14 passed, 0 failed (47.3 seconds).
- Four additional browser tests cover 10 workspace pages at 390, 768 and 1440px,
  mobile navigation, document-level horizontal overflow, stylesheet availability,
  the button cascade regression, and compact mobile authentication.
- The existing 10 mocked browser contract tests still pass, including upload,
  approval, investigation display, review and PDF export.
- Screenshots inspected: `tmp/ui-1440-findings.png`, `tmp/ui-390-documents.png`,
  `tmp/ui-after-auth.png`. Additional route screenshots are under `tmp/ui-*`.
- Refreshed production server is available at http://localhost:3000.

Browser contract tests intercept Auth, API and Storage requests with explicitly
synthetic fixtures. They do not prove hosted authentication or persistence. No
paid research runs, credential changes, deployment or remote Git writes occurred.
