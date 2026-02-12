# Feature: File Browser

## Purpose
List, preview, download, and delete files stored in Backblaze B2.

## Used By
- UI: `/files` page, file browser component
- API: `GET /files`, `GET /files/{key}`, `GET /files/{key}/download`, `DELETE /files/{key}`

## Core Functions
- `apps/web/src/components/files/file-browser.tsx` — sortable table with action dropdown
- `apps/web/src/components/files/file-preview.tsx` — dialog modal for file preview
- `apps/web/src/components/files/file-metadata-panel.tsx` — structured metadata display
- `apps/web/src/lib/api-client.ts` — `getFiles()`, `getDownloadUrl()`, `deleteFile()`
- `services/api/app/routes/files.py` — list, get, download, delete endpoints
- `services/api/app/services/b2_s3.py` — `list_files()`, `get_file_metadata()`, `get_presigned_url()`, `delete_file()`

## Inputs
- prefix: string (optional filter for file listing)
- limit: int (max files to return, default 100)
- key: string (file key for get/download/delete)

## Outputs
- `GET /files` → `FileMetadata[]`
- `GET /files/{key}` → `FileMetadata`
- `GET /files/{key}/download` → `{ url: string }` (presigned URL)
- `DELETE /files/{key}` → `{ deleted: true, key: string }`
- Side effects: DELETE removes file from B2

## Flow
- Page loads → fetches file list from `GET /files`
- Table renders with filename, size, type, upload date
- User clicks action menu → preview / download / delete
- Preview: fetches presigned URL, shows image inline or PDF in iframe
- Download: opens presigned URL in new tab
- Delete: calls `DELETE /files/{key}`, removes row from table, shows toast

## Edge Cases
- File not found (deleted externally) → API returns 404
- B2 unreachable → API error, toast notification
- Empty bucket → "No files found" message with upload prompt
- Delete failure → API returns 500, toast error

## UX States
- Empty: centered message with upload prompt
- Loading: skeleton rows
- Error: toast notification
- Loaded: table with action dropdowns

## Tests
- No test harness yet
- Required cases: list files, empty list, file not found, presigned URL generation, delete success, delete failure

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
