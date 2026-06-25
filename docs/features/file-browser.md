<!-- last_verified: 2026-06-25 -->
# Feature: File Browser

## Purpose
List, preview, download, and delete files stored in Backblaze B2.

## Used By
- UI: `/files` page, file browser component
- API: `GET /files`, `GET /files/{key}`, `GET /files/{key}/download`, `GET /files/{key}/preview`, `DELETE /files/{key}`

## Core Functions
- `apps/web/src/components/files/file-browser.tsx` — tree view container with loading, empty, error, refresh, preview, download, and delete flows
- `apps/web/src/components/files/file-tree-row.tsx` — recursive folder/file rows with keyboard-friendly actions and long-name handling
- `apps/web/src/components/files/file-preview.tsx` — dialog modal for file preview
- `apps/web/src/components/files/file-metadata-panel.tsx` — structured metadata display
- `apps/web/src/lib/file-tree.ts` — `buildFileTree()` converts flat S3 keys to folder/file hierarchy
- `apps/web/src/lib/api-client.ts` — `getFiles()`, `getDownloadUrl()`, `deleteFile()`
- `services/api/app/runtime/files.py` — HTTP handlers for list, get, download, delete
- `services/api/app/service/files.py` — business logic, key validation
- `services/api/app/repo/b2_client.py` — `list_files()`, `get_file_metadata()`, `get_presigned_url()`, `delete_file()`

## Canonical Files
- File route handlers: `services/api/app/runtime/files.py`
- File tree builder: `apps/web/src/lib/file-tree.ts`
- B2 data access pattern: `services/api/app/repo/b2_client.py`

## Inputs
- prefix: string (optional filter for file listing)
- limit: int (max files to return, 1-1000, default 100)
- key: string (file key for get/download/delete — no path traversal)

## Outputs
- `GET /files` → `FileMetadata[]` (sorted most recent first)
- `GET /files/{key}` → `FileMetadata`
- `GET /files/{key}/download` → `{ url: string }` (presigned URL, attachment disposition, 10-min expiry). Increments the `total_downloads` counter exposed on `/files/stats`. The counter is persisted to `services/api/data/download_count.json` (override via `DOWNLOAD_COUNT_FILE` env var) so it survives API restarts.
- `GET /files/{key}/preview` → `{ url: string }` (presigned URL for inline rendering, 10-min expiry). Does **not** increment the download counter — used by the preview modal for images / PDFs.
- `DELETE /files/{key}` → `{ deleted: true, key: string }`
- Side effects: DELETE removes file from B2; `/download` increments the in-memory download counter

## Flow
- Page loads → fetches file list from `GET /files` (sorted most recent first)
- Files organized into tree view — folders expand/collapse, files shown with type-specific icons
- Top-level folders auto-expand on load
- User hovers or focuses a file row → action menu appears (preview / download / delete); touch-sized menu button remains visible on small screens
- Preview: opens dialog, fetches a preview-only presigned URL via `/files/{key}/preview` (does not count as a download) and renders image/PDF inline
- Download: fetches presigned URL via `/files/{key}/download` (attachment disposition, 10-min expiry), opens in new tab, bumps the download counter, triggers a stats refresh
- Delete: calls `DELETE /files/{key}`, removes row from tree, shows toast
- All key-based API calls validated against path-traversal patterns

## Edge Cases
- File not found (deleted externally) → API returns 404
- Invalid file key (traversal attempt, empty key) → API returns 400
- B2 unreachable → persistent error state with retry
- Empty bucket → upload prompt with direct Upload action
- Delete failure → API returns 500, toast error

## UX States
- Empty: centered message with upload prompt and Upload action
- Loading: skeleton rows
- Error: inline error state with Retry
- Loaded: tree view with expand/collapse folders and focus/hover action menus
- Preview: responsive dialog with wrapped file names, fallback copy for preview URL failures, and metadata that tolerates long keys

## Verification
- Test files: `services/api/tests/` (no dedicated file browser tests yet)
- Required cases: list files, empty list, file not found, presigned URL generation, delete success, delete failure
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
