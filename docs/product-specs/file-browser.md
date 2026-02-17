# Product Spec: File Browser

## Purpose
List, preview, download, and delete files stored in Backblaze B2.

## Used By
- UI: `/files` page, file browser component
- API: `GET /files`, `GET /files/{key}`, `GET /files/{key}/download`, `DELETE /files/{key}`

## Core Functions
- `apps/web/src/components/files/file-browser.tsx` — tree view with expand/collapse folders, type-specific icons, hover action menus
- `apps/web/src/components/files/file-preview.tsx` — dialog modal for file preview
- `apps/web/src/components/files/file-metadata-panel.tsx` — structured metadata display
- `apps/web/src/lib/file-tree.ts` — `buildFileTree()` converts flat S3 keys to folder/file hierarchy
- `apps/web/src/lib/api-client.ts` — `getFiles()`, `getDownloadUrl()`, `deleteFile()`
- `services/api/app/runtime/files.py` — HTTP handlers for list, get, download, delete
- `services/api/app/service/files.py` — business logic, key validation
- `services/api/app/repo/b2_client.py` — `list_files()`, `get_file_metadata()`, `get_presigned_url()`, `delete_file()`

## Inputs
- prefix: string (optional filter for file listing)
- limit: int (max files to return, 1–1000, default 100)
- key: string (file key for get/download/delete — must start with allowed prefix, no traversal)

## Outputs
- `GET /files` → `FileMetadata[]` (sorted most recent first)
- `GET /files/{key}` → `FileMetadata`
- `GET /files/{key}/download` → `{ url: string }` (presigned URL, attachment disposition, 10-min expiry)
- `DELETE /files/{key}` → `{ deleted: true, key: string }`
- Side effects: DELETE removes file from B2

## Flow
- Page loads → fetches file list from `GET /files` (sorted most recent first)
- Files organized into tree view — folders expand/collapse, files shown with type-specific icons
- Top-level folders auto-expand on load
- User hovers file row → action buttons appear (preview / download / delete)
- Preview: opens dialog with image/PDF preview + metadata panel
- Download: fetches presigned URL (attachment disposition, 10-min expiry), browser downloads file
- Delete: calls `DELETE /files/{key}`, removes row from tree, shows toast
- All key-based API calls validated against allowed prefixes and path traversal patterns

## Edge Cases
- File not found (deleted externally) → API returns 404
- Invalid file key (traversal attempt, wrong prefix) → API returns 400
- B2 unreachable → API error, toast notification
- Empty bucket → "No files found" message with upload prompt
- Delete failure → API returns 500, toast error

## UX States
- Empty: centered message with upload prompt
- Loading: skeleton rows
- Error: toast notification
- Loaded: tree view with expand/collapse folders and hover action menus

## Tests
- No test harness yet
- Required cases: list files, empty list, file not found, presigned URL generation, delete success, delete failure

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
