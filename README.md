<!-- last_verified: 2026-05-28 -->
# B2 Verification Dashboard

A sample app built on the [vibe-coding-starter-kit](https://github.com/backblaze-b2-samples/vibe-coding-starter-kit) that demonstrates a **verification artifact pipeline**: Playwright tests run against the app, produce named screenshots per UI state, and upload evidence to Backblaze B2. A verification dashboard reads that evidence back from B2 and displays run history and screenshots.

## What it demonstrates

- **Tests as documentation**: every UI state has a named screenshot stored in B2 — `upload--idle.png`, `files--empty.png`, `verify--loaded.png`, etc.
- **Agent-native test generation**: `/gen-e2e` is a Claude Code slash command that reads `docs/features/*.md` and writes state-based Playwright tests. Feature docs are the source of truth; tests follow.
- **Evidence-first workflow**: `pnpm verify` runs tests and uploads the artifact bundle. The dashboard shows every run — when it passed, what changed, and screenshots of exactly what the agent built.

## Quick start

**Prerequisites**: Node 20+, pnpm 9+, Python 3.11+, a Backblaze B2 account.

```bash
git clone <this-repo> b2-verification-dashboard
cd b2-verification-dashboard
cp .env.example .env
# Fill in B2_ENDPOINT, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME
pnpm install
cd services/api && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ../..
pnpm dev
```

Open `http://localhost:3000`. The dashboard is empty until you run `pnpm verify`.

> **Port expectations**: `pnpm dev` starts the frontend on port 3000 and the API on port 8000. `pnpm verify` and `pnpm test:e2e` expect both to be running at those addresses. For a fresh clone there is no conflict — just run `pnpm dev` first, then `pnpm verify` in a second terminal.

## The three commands

```bash
# Run the app
pnpm dev

# Run Playwright tests and upload artifacts to B2
pnpm verify

# Same, but always upload screenshots even on a clean run (for demos and reviews)
VERIFY_RECORD=1 pnpm verify
```

After `pnpm verify`, the dashboard at `/` shows the run. Click a row to see the
screenshot gallery — images are served directly from B2 via presigned URLs.

## What gets uploaded to B2

```
verification-runs/
  {YYYY-MM-DD}--{runId}/
    summary.json        always
    results.json        always
    screenshots/        on failure or VERIFY_RECORD=1
      upload--idle.png
      files--empty.png
      ...
    traces/             on failure or VERIFY_RECORD=1
      *.zip
```

Screenshots and traces are only uploaded when something broke (or when `VERIFY_RECORD=1`). Clean runs store just the summary and results JSON — cheap and queryable.

## The `/gen-e2e` slash command

`/gen-e2e` (or `/gen-e2e upload`, `/gen-e2e file-browser`, `/gen-e2e verification`) reads the relevant `docs/features/*.md` and generates or refreshes Playwright tests in `apps/web/e2e/`. Each test mocks the API via `page.route()` and takes a named screenshot.

Use it when:
- You add a new UX state to a feature
- A feature doc gets updated with new edge cases
- You want to audit whether tests cover everything in the doc

## Inherited from the starter kit

This app is built on the [vibe-coding-starter-kit](https://github.com/backblaze-b2-samples/vibe-coding-starter-kit):
- File upload with drag-and-drop and progress tracking (`/upload`)
- File browser with tree view, preview, download, delete (`/files`)
- FastAPI backend with strict layered architecture
- shadcn/ui design system and `/design` reference page
- `AGENTS.md` + `ARCHITECTURE.md` — agent-readable documentation

The only screen replaced is the dashboard (the starter kit's default stats/chart/table → this app's verification runs list).

## Developer commands

```bash
pnpm dev             # start both frontend and backend
pnpm test:e2e        # Playwright e2e tests (hermetic, no live B2)
pnpm typecheck       # TypeScript type check
pnpm lint            # ESLint
pnpm lint:api        # ruff
pnpm test:api        # pytest
pnpm check:structure # architectural boundary tests
```
