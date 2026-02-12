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
- `services/api/app/routes/upload.py` — validates and uploads to B2
- `services/api/app/services/b2_s3.py` — `upload_file()` via boto3 `put_object`
- `services/api/app/services/metadata.py` — `extract_metadata()` after upload

## Inputs
- file: `File` (from browser, multipart form data)
- content_type: string (from file MIME type)

## Outputs
- `FileUploadResponse`: key, filename, size, content_type, uploaded_at, url, metadata
- Side effects: file stored in B2 bucket under `uploads/{uuid}_{filename}`

## Flow
- User drops or selects files in dropzone
- Client validates file presence
- XHR sends multipart POST to `/upload` with progress events
- API validates file size (<= 100MB) and content type (allowlist)
- API generates unique key: `uploads/{uuid12}_{filename}`
- API calls `put_object` to B2
- API extracts file metadata (checksums, image dimensions, PDF info)
- API returns `FileUploadResponse`
- Client shows toast and updates progress state

## Edge Cases
- File exceeds 100MB → API returns 413
- File type not in allowlist → API returns 415
- No filename provided → API returns 400
- B2 unreachable → API returns 500
- Upload aborted by user → XHR abort, error state in UI

## UX States
- Empty: dropzone with instructions
- Loading: per-file progress bars with spinner icon
- Error: red status icon, error message per file
- Complete: green checkmark, "Clear completed" button

## Tests
- No test harness yet
- Required cases: successful upload, oversized file rejection, disallowed type rejection, missing filename, progress callback fires

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
- [Metadata Extraction](metadata-extraction.md)
