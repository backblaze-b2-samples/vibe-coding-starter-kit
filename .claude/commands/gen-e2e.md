Read before doing anything:
- AGENTS.md
- ARCHITECTURE.md
- apps/web/playwright.config.ts
- packages/shared/src/types.ts
- apps/web/src/lib/api-client.ts

Then read the feature doc for the feature in $ARGUMENTS:
- "upload"       → docs/features/file-upload.md
- "file-browser" → docs/features/file-browser.md
- "verification" → docs/features/verification.md
- (no argument)  → read all three

Then read the source files listed under "Core Functions" in that feature doc.
Then read the existing spec file for that feature in apps/web/e2e/.

For each state in `## UX States` and each case in `## Edge Cases` in the feature doc:

1. If the existing spec already covers that state with a meaningful assertion
   (not just a URL check), leave it alone.

2. If the state is missing or only URL-checked, write or replace a test that:
   a. Mocks API endpoints via `page.route()` — no live network calls.
      API base is `http://localhost:8000` (from NEXT_PUBLIC_API_URL or default).
      Paths (from api-client.ts):
        GET  /files?prefix=&limit=100   → FileMetadata[]
        GET  /files/stats               → UploadStats
        GET  /files/stats/activity?*    → DailyUploadCount[]
        GET  /files/{key}/download      → { url: string }
        GET  /files/{key}/preview       → { url: string }
        DELETE /files/{key}             → { deleted: true, key: string }
        POST /upload                    → FileUploadResponse
        GET  /verify/runs               → VerifyRunSummary[]
        GET  /verify/runs/{id}          → VerifyRunDetail
      Always also mock GET /health → { status: "healthy", b2_connected: true }
   b. Navigates to the feature's route.
   c. Asserts a visible element using `data-testid` selectors. If the required
      attribute is missing from the component, add it (kebab-case, descriptive name)
      before writing the assertion.
   d. Takes a named screenshot:
      `await page.screenshot({ path: 'playwright-results/screenshots/{feature}--{state}.png', fullPage: false })`
      State name: kebab-case version of the state name from the feature doc.
   e. Names the test: `"{feature} — {state from doc}"`

After writing or updating tests, run:
  pnpm --filter @vibe-coding-starter-kit/web exec playwright test --reporter=list

Fix missing data-testid attributes before weakening any assertion.
Do not change passing tests.
Do not add bare useEffect+fetch to any component.
