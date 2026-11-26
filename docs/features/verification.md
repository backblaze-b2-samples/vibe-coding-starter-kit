<!-- last_verified: 2026-11-25 -->
# Feature: Verification Runs

## Purpose
Store the evidence of a Playwright run (summary, results, failure screenshots and
traces) in the app's own B2 bucket and browse it at `/verify`.

## Used By
- UI: `/verify` (run list) and `/verify/{runId}` (run detail)
- API: `GET /verify/runs`, `GET /verify/runs/{run_id}`
- Command: `pnpm verify:upload` (writes the evidence)

The main dashboard at `/` is unchanged; this feature lives under its own route.

## Commands

| Command | Effect |
|---------|--------|
| `pnpm verify` | The credential-free canonical gate. Unrelated to this feature; it never talks to B2 |
| `pnpm verify:upload` | Run `pnpm test:e2e`, then upload the evidence. Exits non-zero if the tests failed **or** the upload failed; failures are uploaded too |
| `VERIFY_RECORD=1 pnpm verify:upload` | Same, but also keeps and uploads every screenshot and trace, not only failures |
| `node scripts/verify-upload.mjs --upload-only` | Upload results that already exist (for example produced by CI) without re-running tests |

`verify:upload` needs a real `.env` (the B2 variables the API uses) and
Playwright's browser. It is not part of `pnpm verify` or CI.

## B2 Storage Layout

```
verification-runs/
  {YYYY-MM-DD}--{8 hex}/
    summary.json          always
    results.json          always (full Playwright JSON report)
    screenshots/          on failure or VERIFY_RECORD=1 (subfolders per test kept)
    traces/               on failure or VERIFY_RECORD=1
```

Summaries and results are small and give the full history; screenshots and traces
are larger and only matter when something broke or a change needs review.

## Inputs
- `run_id` path parameter: must match `YYYY-MM-DD--` followed by eight lowercase
  hex characters. Anything else is rejected with 422 before a storage key is built.

## Outputs
- `GET /verify/runs` -> `VerifyRunSummary[]`, newest first, at most the newest 50 runs
- `GET /verify/runs/{run_id}` -> `VerifyRunDetail` (summary, results, presigned
  screenshot and trace URLs valid for 10 minutes, like file downloads)

## Flow
1. `scripts/verify-upload.mjs` runs `pnpm test:e2e` with a JSON report path set.
2. It builds the summary from the report and uploads `summary.json` and `results.json`.
   Its S3 client sends the same B2 custom user agent as the API (`attribution_token`
   in `docs/exec-plans/sample.json`, equal to `user_agent_extra` in `b2_client.py`).
3. If a test failed, or `VERIFY_RECORD=1`, it also uploads screenshots and traces
   from `apps/web/test-results/` (recursively), with content types set by extension.
4. It prints the run id and the `/verify/{runId}` URL, then exits with the tests'
   status (or non-zero if the upload failed).

## Edge Cases
- Missing `summary.json`: `GET /verify/runs/{id}` returns 404.
- Malformed `summary.json`: skipped in the list and logged as a warning.
- More run prefixes than one B2 page: every page is read (continuation tokens),
  then only the newest 50 summaries are fetched.
- The run list is cached in-process for 30 seconds, so refreshing the page does not
  read every summary from B2 again.
- B2 unreachable: the API returns a 5xx and the page shows an error state.
- Presigned URLs expire after 10 minutes; reloading the detail page makes new ones.

## UX States
- List: loading skeleton, empty (with the `pnpm verify:upload` hint), loaded table, error with retry.
- Detail: loading, loaded with screenshots, loaded without screenshots (explains when they are stored), traces list, error.

## Canonical Files
- Uploader: `scripts/verify-upload.mjs` (pure helpers and tests in `scripts/verify-upload/`)
- API: `services/api/app/repo/verify_repo.py`, `service/verify.py`, `runtime/verify.py`, `types/verify.py`
- Pages: `apps/web/src/app/verify/page.tsx`, `apps/web/src/app/verify/[runId]/page.tsx`
- Components: `apps/web/src/components/verify/`
- Hooks: `apps/web/src/lib/queries.ts` (`useVerifyRuns`, `useVerifyRun`)

## Verification
- API: `services/api/tests/test_verify_runs.py` (fake S3 client at the repo boundary)
- Client: `apps/web/src/lib/verify-api.test.ts`
- Uploader helpers: `scripts/verify-upload/lib.test.mjs` (`pnpm test:scripts`)
- UI states: `apps/web/e2e/verify-dashboard.spec.ts` (API mocked with `page.route()`; `pnpm test:e2e`)

## Security
Like every other route in this API, `/verify/*` is unauthenticated and
bucket-wide (see [SECURITY.md](../SECURITY.md)); the rate limiter applies. The
screenshots and traces it links to are test evidence: do not point the suite at
data you would not want a reader of the dashboard to see.
