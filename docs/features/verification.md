<!-- last_verified: 2026-05-28 -->
# Feature: Verification Pipeline

## Purpose
Run Playwright tests, store artifacts (screenshots, traces, results) in Backblaze B2,
and surface run history + evidence through the verification dashboard.

## Commands

| Command | Effect |
|---------|--------|
| `pnpm verify` | Run tests; always upload `summary.json` + `results.json`; upload screenshots/traces only on failure |
| `VERIFY_RECORD=1 pnpm verify` | Same, but always uploads screenshots and traces regardless of pass/fail |
| `pnpm test:e2e` | Run tests only — no B2 upload |
| `/gen-e2e [feature]` | Generate or refresh state-based e2e tests from `docs/features/<feature>.md` |

## B2 Storage Layout

```
verification-runs/
  {YYYY-MM-DD}--{runId}/
    summary.json          always — small, cheap, queryable
    results.json          always — full Playwright JSON output
    screenshots/          on failure or VERIFY_RECORD=1
      {feature}--{state}.png
    traces/               on failure or VERIFY_RECORD=1
      *.zip
```

### Artifact tier rationale

> **Why not store everything on every run?**
> `summary.json` and `results.json` are small and give the full run history.
> Screenshots and traces are large and only matter when something broke or when an
> agent made a UI change that needs review. Uploading them on every clean CI run
> adds cost and noise with no benefit.

## Flow

1. `pnpm verify` runs `pnpm test:e2e` (Playwright against `http://localhost:3000`)
2. Tests use `page.route()` to mock API calls — no live B2, hermetic
3. After tests complete (pass or fail), `scripts/upload-verify-run.ts` runs
4. Script reads `apps/web/playwright-results/results.json` (Playwright JSON reporter)
5. Derives a `VerifyRunSummary` — run_id, timestamp, total/passed/failed, duration, git_sha
6. Uploads `summary.json` + `results.json` to `verification-runs/{runId}/`
7. If `failed > 0` or `VERIFY_RECORD=1`: also uploads screenshots and traces
8. Prints the run ID and a `View at:` URL

## UX States

### Dashboard (`/`)

- **Loading**: skeleton rows while `GET /verify/runs` is pending
- **Empty**: "No verification runs yet." with `pnpm verify` hint
- **Loaded**: table of runs with date, status badge, test counts, duration, commit SHA
- **Error**: `ErrorState` with Retry button

### Run Detail (`/verify/{runId}`)

- **Loading**: skeleton placeholders
- **Loaded with screenshots**: grid of `<img>` elements, each clickable to open full-size
- **Loaded without screenshots**: muted note explaining when screenshots are uploaded
- **With traces**: section with download links for trace zips
- **Error**: `ErrorState` with Retry button

## Edge Cases

- Missing `summary.json` (run deleted from B2): `GET /verify/runs/{id}` returns 404
- Malformed `summary.json`: skipped silently in `list_runs`, logged as warning
- B2 unreachable: `RuntimeError` propagates as 500 to the frontend `ErrorState`
- Presigned URLs expire (1 hour): screenshots/traces become temporarily unavailable; reloading the detail page regenerates fresh URLs

## Canonical Files

- Upload script: `scripts/upload-verify-run.ts`
- API repo layer: `services/api/app/repo/verify_repo.py`
- API service: `services/api/app/service/verify.py`
- API routes: `services/api/app/runtime/verify.py`
- Dashboard page: `apps/web/src/app/page.tsx`
- Run detail page: `apps/web/src/app/verify/[runId]/page.tsx`
- Dashboard components: `apps/web/src/components/dashboard/`
- Frontend hooks: `apps/web/src/lib/queries.ts` (`useVerifyRuns`, `useVerifyRun`)
- Shared types: `packages/shared/src/types.ts` (`VerifyRunSummary`, `VerifyRunDetail`)
- Test generator: `.claude/commands/gen-e2e.md`

## Verification

- Test files: `apps/web/e2e/dashboard.spec.ts`
- Required states: loading, empty, loaded, has-failures, run detail with screenshots, run detail without screenshots
- Run command: `pnpm test:e2e`
- All tests mock the API via `page.route()` — no live B2 required

## Running in CI

`pnpm test:e2e` targets `http://localhost:3000` by default. If port 3000 is occupied —
for example, in a GitHub Actions matrix where another service already binds it — start
the dev server on an alternate port and pass `BASE_URL`:

```bash
BASE_URL=http://localhost:3001 pnpm test:e2e
```

`playwright.config.ts` reads `process.env.BASE_URL ?? "http://localhost:3000"` as its
`baseURL`, so no config file edit is needed.

## Related Docs

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
- [File Browser](file-browser.md)
