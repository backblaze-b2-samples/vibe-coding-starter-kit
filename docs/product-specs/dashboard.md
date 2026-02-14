# Product Spec: Dashboard

## Purpose
Provide an at-a-glance overview of file storage usage and recent upload activity.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /files/stats`, `GET /files`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 stat cards
- `apps/web/src/components/dashboard/recent-uploads-table.tsx` — last 10 uploads
- `apps/web/src/components/dashboard/upload-chart.tsx` — bar chart of uploads per day
- `apps/web/src/lib/api-client.ts` — `getFileStats()`, `getFiles()`
- `services/api/app/runtime/files.py` — `GET /files/stats` handler
- `services/api/app/service/files.py` — `get_stats()` business logic
- `services/api/app/repo/b2_client.py` — `get_upload_stats()` data access

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /files/stats` → `UploadStats` (total_files, total_size_bytes, total_size_human, uploads_today, total_downloads)
- `GET /files` (limit 10) → `FileMetadata[]` for recent uploads table
- `GET /files` (limit 1000) → `FileMetadata[]` for chart aggregation

## Flow
- Page loads → three parallel API calls (stats, recent files, all files for chart)
- Stats cards display total files, storage used, uploads today, total downloads
- Upload chart aggregates files by day, shows last 7 days as bar chart
- Recent uploads table shows last 10 files with filename, size, type, date, status badge

## Edge Cases
- API unavailable → stats default to zeros, table shows empty state
- No files uploaded → empty chart message, empty table message
- Large file count → stats endpoint iterates up to 10,000 objects

## UX States
- Loading: skeleton placeholders for cards and table
- Empty: "No files uploaded yet" / "No upload data available yet"
- Loaded: populated cards, chart, table

## Tests
- No test harness yet
- Required cases: stats with files, stats with empty bucket, API error fallback

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
