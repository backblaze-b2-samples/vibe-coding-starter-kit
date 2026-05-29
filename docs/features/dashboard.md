<!-- last_verified: 2026-05-28 -->
# Feature: Verification Dashboard

## Purpose
Display a history of Playwright verification runs stored in Backblaze B2, with
pass/fail status, test counts, duration, and commit SHA for each run. Clicking a
run navigates to the run detail page which shows stored screenshots and traces.

## Used By
- UI: `/` page (dashboard home), `/verify/[runId]` (run detail)
- API: `GET /verify/runs`, `GET /verify/runs/{id}`

## Core Functions
- `apps/web/src/app/page.tsx` — verification runs list page
- `apps/web/src/app/verify/[runId]/page.tsx` — run detail page
- `apps/web/src/components/dashboard/VerifyRunsTable.tsx` — runs table
- `apps/web/src/components/dashboard/RunStatusBadge.tsx` — pass/fail badge
- `apps/web/src/lib/api-client.ts` — `listVerifyRuns()`, `getVerifyRun()`
- `services/api/app/runtime/verify.py` — `GET /verify/runs`, `GET /verify/runs/{id}`
- `services/api/app/service/verify.py` — service orchestration
- `services/api/app/repo/verify_repo.py` — B2 reads (summary.json, presigned URLs)

## Inputs
- None (dashboard loads automatically)
- Run ID parameter for detail page (from URL)

## Outputs
- `GET /verify/runs` → `VerifyRunSummary[]` (sorted newest-first)
- `GET /verify/runs/{id}` → `VerifyRunDetail` (includes `screenshot_urls`, `trace_urls`)

## Flow
- Dashboard loads → calls `GET /verify/runs`
- Runs table shows: date, status badge, test counts, duration, commit SHA
- Each row is clickable and navigates to `/verify/{run_id}`
- Detail page loads → calls `GET /verify/runs/{run_id}`
- Screenshot grid renders `<img>` elements from presigned B2 URLs (1-hour expiry)
- Clicking a screenshot opens full-size in a new tab
- Trace section (if traces exist) lists download links

## Edge Cases
- No runs yet → empty state with `pnpm verify` hint
- B2 unreachable → ErrorState with Retry
- Run not found (deleted from B2) → 404 from API, ErrorState on detail page
- Screenshots expired (>1 hour old presigned URL) → reload detail page to regenerate

## UX States
- Loading: skeleton rows
- Empty: "No verification runs yet." with `pnpm verify` hint
- Loaded: runs table with clickable rows
- Error: ErrorState with Retry button
- Detail — loading: skeleton placeholders
- Detail — with screenshots: screenshot grid
- Detail — no screenshots: muted "No screenshots stored" message
- Detail — with traces: trace download links section

## Verification
- Test files: `apps/web/e2e/dashboard.spec.ts`
- Required cases: loading, empty, loaded, has-failures, detail with screenshots, detail without
- Run command: `pnpm test:e2e`
- All tests are hermetic (mock API via `page.route()`, no live B2)

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Verification Pipeline](verification.md)
- [App Workflows](../app-workflows.md)
