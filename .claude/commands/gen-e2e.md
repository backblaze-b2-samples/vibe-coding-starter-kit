Generate or refresh state-based Playwright tests for one feature.

Read before doing anything:
- AGENTS.md
- ARCHITECTURE.md
- apps/web/playwright.config.ts
- apps/web/src/lib/generated/api-routes.ts (the API paths and methods; never hardcode a path that is not listed there)
- apps/web/src/lib/api-client.ts (how each call is made, including the presign -> PUT -> verify upload)

Then read the feature doc for the feature in $ARGUMENTS:
- "upload"       → docs/features/file-upload.md, spec apps/web/e2e/upload-states.spec.ts
- "file-browser" → docs/features/file-browser.md, spec apps/web/e2e/file-browser.spec.ts
- "verification" → docs/features/verification.md, spec apps/web/e2e/verify-dashboard.spec.ts
- (no argument)  → all three

Then read the source files listed under "Core Functions" in that feature doc,
and the existing spec file for that feature.

For each state in `## UX States` and each case in `## Edge Cases` in the feature doc:

1. If the existing spec already covers that state with a meaningful assertion
   (not just a URL check), leave it alone.

2. If the state is missing or only URL-checked, write or replace a test that:
   a. Imports `test`, `expect` and `json` from `./fixtures/mock-api` (never
      from `@playwright/test`) and mocks every API call it triggers with
      `api.route("<pathname>", handler)`. That matches the path on whatever
      origin the API is on: `scripts/dev.sh` moves the API off port 8000 when
      8000 is busy, so never match on a port or a hardcoded API URL. The
      fixture aborts every API request no mock served and fails the test, so
      an unmocked call can never reach a real API or bucket; add the missing
      mock rather than working around the guard. Use `json(body, status)`
      for responses (it adds the CORS header the cross-origin page needs).
      Always also mock `/health` with `{ "status": "healthy", "b2_connected": true }`.
      A non-API URL (such as a presigned storage URL) is mocked with
      `page.route(url, ...)` and must be a placeholder host, never a real bucket.
   b. Navigates to the feature's route.
   c. Asserts a visible element or state with `getByTestId(...)` or a role
      query. If a needed `data-testid` is missing from the component, add it
      (kebab-case, descriptive) before writing the assertion. Never edit
      `apps/web/src/components/ui/`.
   d. Names the test `"{feature} — {state from doc}"`.

Screenshots come from the Playwright config (failures always; every test with
`VERIFY_RECORD=1`), so tests do not call `page.screenshot()` themselves.

After writing or updating tests, run:
  pnpm test:e2e

Fix missing data-testid attributes before weakening any assertion.
Do not change passing tests.
Do not add bare useEffect+fetch to any component.
