<!-- last_verified: 2026-07-28 -->
# Feature: Dashboard

## Purpose
Provide an at-a-glance overview of file storage usage and recent upload activity.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /files/stats`, `GET /files`, `GET /files/stats/activity`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 stat cards, plus the on-screen loading notice while the bucket scan runs
- `apps/web/src/components/dashboard/recent-uploads-table.tsx` — last 10 uploads
- `apps/web/src/components/dashboard/upload-chart.tsx` — bar chart of uploads per day
- `apps/web/src/lib/api-client.ts` — `getFileStats()`, `getFiles()`, `getUploadActivity()`
- `services/api/app/runtime/files.py` — `GET /files/stats` handler
- `services/api/app/service/files.py` — `get_stats()` business logic
- `services/api/app/repo/b2_client.py` — `get_upload_stats()` data access
- `services/api/app/repo/list_cache.py` — the shared bucket listing both `/files/stats` and `/files` read, so the dashboard and the file browser never scan twice
- `apps/web/src/components/common/loading-notice.tsx` — visible, escalating wait copy

## Canonical Files
- Dashboard page layout: `apps/web/src/components/dashboard/stats-cards.tsx`
- Stats service logic: `services/api/app/service/files.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /files/stats` → `UploadStats` (total_files, total_size_bytes, total_size_human, uploads_today, total_downloads)
- `GET /files` (limit 10) → `FileMetadata[]` for recent uploads table (sorted newest-first)
- `GET /files/stats/activity?days=7` → `DailyUploadCount[]` for chart (server-side aggregation)

## Flow
- Page loads → three parallel API calls (stats, recent files, upload activity), all served from one cached bucket listing
- Stats needed ~8.3s to replace the skeletons on a 16k-object bucket, so: the API warms that listing at startup and serves it stale-while-revalidate (only the very first scan after boot can block), and the cards state the wait in words while it runs instead of showing four silent placeholders
- Stats cards display total files, storage used, uploads today, total downloads
- Upload chart displays server-aggregated daily counts for last 7 days as bar chart after activity data is known
- Recent uploads table shows last 10 files with filename, size, type, date, status badge. Each filename is a link to `/files?preview=<key>`, which opens that file's preview in the browser — the rows used to be inert text with no role, tabindex or handler, so the "click a file to preview it" gesture `/files` teaches did nothing here

## Edge Cases
- API unavailable → error states with retry where supported; activity chart does not show a false zero state while loading
- No files uploaded → empty chart message, empty table message
- Large file count → stats endpoint paginates through all objects using `ContinuationToken`; the result is cached, so the cost is paid once (at startup) rather than per page view
- Bucket changed by something other than this app → numbers can lag by up to `LIST_CACHE_TTL_SECONDS` (default 300s). The app's own uploads/deletes invalidate the cache, so they are never stale

## UX States
- Loading: an on-screen "Loading bucket stats…" notice above the cards (escalating at 4s and 12s), with skeleton placeholders for cards, table, and upload activity chart
- Empty: "No files uploaded yet" / "No upload data available yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_upload_activity.py`, `services/api/tests/test_recent_files.py`, `services/api/tests/test_list_cache.py`, `apps/web/src/lib/loading-progress.test.ts`
- Required cases: stats with files, stats with empty bucket, API error fallback, cached listing reused across stats and listing calls, loading copy escalating at its thresholds
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Dev Workflows](../dev-workflows.md#commands) are available
- Pass criteria: focused tests and `pnpm verify` green; explain any skipped `pnpm verify:full` prerequisites

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
