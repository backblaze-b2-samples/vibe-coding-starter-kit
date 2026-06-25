<!-- last_verified: 2026-05-28 -->
# Feature: Dashboard

> **Note:** The root `/` route has been replaced by the [Intelligence Dashboard](intelligence-dashboard.md) as part of the demand-side-ai issue intelligence app (see AGENTS.md §2 and §2a). The file-storage dashboard components below remain in the codebase as starter kit scaffolding but are no longer rendered at `/`.

## Purpose
Provide an at-a-glance overview of file storage usage and recent upload activity. These components serve as reference implementations for the starter kit; the active dashboard is the Intelligence overview at `/` and `/intelligence`.

## Used By
- UI: `/intelligence` page (active dashboard home, replaced `/`)
- Starter kit scaffolding: `apps/web/src/components/dashboard/` (kept, not rendered at root)
- API: `GET /files/stats`, `GET /files`, `GET /files/stats/activity`

## Core Functions (starter kit scaffolding — kept, not active at `/`)
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 stat cards
- `apps/web/src/components/dashboard/recent-uploads-table.tsx` — last 10 uploads
- `apps/web/src/components/dashboard/upload-chart.tsx` — bar chart of uploads per day
- `apps/web/src/lib/api-client.ts` — `getFileStats()`, `getFiles()`, `getUploadActivity()`
- `services/api/app/runtime/files.py` — `GET /files/stats` handler
- `services/api/app/service/files.py` — `get_stats()` business logic
- `services/api/app/repo/b2_client.py` — `get_upload_stats()` data access

## Active Dashboard (Intelligence Overview)
The root `/` and `/intelligence` routes now render the Intelligence Dashboard. See [intelligence-dashboard.md](intelligence-dashboard.md) for full documentation.

## Canonical Files
- Active dashboard page: `apps/web/src/app/page.tsx` (intelligence overview)
- Intelligence components: `apps/web/src/components/intelligence/`
- Legacy stats service logic: `services/api/app/service/files.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs (file storage stats — still available via API)
- `GET /files/stats` → `UploadStats` (total_files, total_size_bytes, total_size_human, uploads_today, total_downloads)
- `GET /files` (limit 10) → `FileMetadata[]` for recent uploads table (sorted newest-first)
- `GET /files/stats/activity?days=7` → `DailyUploadCount[]` for chart (server-side aggregation)

## Flow (legacy scaffolding)
- Page loads → three parallel API calls (stats, recent files, upload activity)
- Stats cards display total files, storage used, uploads today, total downloads
- Upload chart displays server-aggregated daily counts for last 7 days as bar chart
- Recent uploads table shows last 10 files with filename, size, type, date, status badge

## Edge Cases
- API unavailable → stats default to zeros, table shows empty state
- No files uploaded → empty chart message, empty table message
- Large file count → stats endpoint paginates through all objects using `ContinuationToken`

## UX States
- Loading: skeleton placeholders for cards and table
- Empty: "No files uploaded yet" / "No upload data available yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_upload_activity.py`, `services/api/tests/test_recent_files.py`
- Required cases: stats with files, stats with empty bucket, API error fallback
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [Intelligence Dashboard](intelligence-dashboard.md) — active root dashboard
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
