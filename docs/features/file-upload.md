<!-- last_verified: 2026-03-10 -->
# Feature: File Upload

## Purpose
Upload files from the browser to Backblaze B2 with real-time progress tracking.

## Used By
- UI: `/upload` page, upload form component
- API: `POST /upload`

## Core Functions
- `apps/web/src/components/upload/upload-form.tsx` — orchestrates dropzone + progress + upload state
- `apps/web/src/components/upload/dropzone.tsx` — drag-and-drop via `react-dropzone`
- `apps/web/src/components/upload/upload-progress.tsx` — per-file progress bars
- `apps/web/src/lib/api-client.ts` — `uploadFile()` using XHR for progress events
- `services/api/app/runtime/upload.py` — HTTP handler, reads file chunks
- `services/api/app/service/upload.py` — validates and orchestrates upload
- `services/api/app/repo/b2_client.py` — `upload_file()` via boto3 `put_object`
- `services/api/app/service/metadata.py` — `extract_metadata()` after upload

## Canonical Files
- Upload handler pattern: `services/api/app/runtime/upload.py`
- Service orchestration pattern: `services/api/app/service/upload.py`
- Frontend upload flow: `apps/web/src/components/upload/upload-form.tsx`

## Inputs
- file: `File` (from browser, multipart form data)
- content_type: string (from file MIME type)

## Outputs
- `FileUploadResponse`: key, filename, size, content_type, uploaded_at, url, metadata
- Side effects: file stored in B2 bucket under `uploads/{sanitized_filename}`

## Flow
- User drops or selects files in dropzone
- Client validates file size (max 100MB) and type — rejected files show toast with reason
- XHR sends multipart POST to `/upload` with progress events
- API checks `Content-Length` header early to reject oversized requests before reading body
- API validates content type against allowlist
- API sanitizes filename (strips path components, null bytes, unsafe chars, limits to 200 chars)
- API validates file extension matches declared MIME type
- API reads file in 1MB chunks with streaming size enforcement (max 100MB)
- API rejects empty files
- API uses key: `uploads/{sanitized_filename}`
- API calls `put_object` to B2
- API extracts file metadata (checksums, image dimensions, PDF info)
- API returns `FileUploadResponse`
- Client shows toast and updates progress state

## Edge Cases
- File exceeds 100MB → client-side rejection toast + API returns 413 if bypassed
- File type not in allowlist → API returns 415
- File extension mismatches MIME type → API returns 415
- No filename provided → API returns 400
- Empty file → API returns 400
- Duplicate filename → B2 creates a new version (buckets are always versioned)
- B2 unreachable → API returns 500
- Upload aborted by user → XHR abort, error state in UI

## UX States
- Empty: dropzone with instructions
- Loading: per-file progress bars with spinner icon
- Error: red status icon, error message per file
- Complete: green checkmark, "Clear completed" button

## Verification
- Test files: `services/api/tests/test_upload_conflict.py`, `services/api/tests/test_error_handling.py`
- Required cases: successful upload, oversized file rejection, disallowed type rejection, missing filename, empty file, duplicate filename allowed
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Metadata Extraction](metadata-extraction.md)
- [App Workflows](../app-workflows.md)
