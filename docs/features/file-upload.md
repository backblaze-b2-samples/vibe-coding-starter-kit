<!-- last_verified: 2026-07-28 -->
# Feature: File Upload

## Purpose
Upload files from the browser to Backblaze B2 with real-time progress tracking.

## Used By
- UI: `/upload` page, upload form component
- API: `POST /upload`

## Core Functions
- `apps/web/src/lib/upload-queue-context.tsx` — `UploadQueueProvider` / `useUploadQueue()`: the app-wide upload queue. Mounted in the root layout, so an upload survives navigation away from `/upload`
- `apps/web/src/lib/upload-status.ts` — `UploadItem`, `uploadStatusLabel()`, `isServerPhase()`, `uploadQueueSummary()`, `activeUploadLabel()`, `interruptedUploadMessage()`
- `apps/web/src/components/upload/upload-form.tsx` — thin view over the provider (dropzone + progress + clear)
- `apps/web/src/components/upload/dropzone.tsx` — drag-and-drop via `react-dropzone`
- `apps/web/src/components/upload/upload-progress.tsx` — per-file progress, errors, retry, a "View in Files" hand-off on completed rows
- `apps/web/src/components/layout/header.tsx` — app-wide "Uploading N files" indicator linking back to `/upload`
- `apps/web/src/lib/api-client.ts` — `uploadFile()` using XHR for progress events
- `services/api/app/runtime/upload.py` — HTTP handler, reads file chunks
- `services/api/app/service/upload.py` — validates and orchestrates upload
- `services/api/app/repo/b2_client.py` — `upload_file()` via boto3 `put_object`
- `services/api/app/service/metadata.py` — `extract_metadata()` after upload

## Canonical Files
- Upload handler pattern: `services/api/app/runtime/upload.py`
- Service orchestration pattern: `services/api/app/service/upload.py`
- Frontend upload flow: `apps/web/src/lib/upload-queue-context.tsx`

## Inputs
- file: `File` (from browser, multipart form data)
- content_type: string (from file MIME type)

## Outputs
- `FileUploadResponse`: key, filename, size, content_type, uploaded_at, url, metadata
- Side effects: file stored in B2 bucket under `uploads/{sanitized_filename}`

## Flow
- User drops or selects files in dropzone
- Client validates file size (max 100MB) and type — rejected files remain in the queue with a clear reason and show toast feedback
- XHR sends multipart POST to `/upload` with progress events
- API checks `Content-Length` header early to reject oversized requests before reading body
- API validates content type against allowlist (SVG excluded — stored-XSS risk)
- API sanitizes filename (strips path components, null bytes, unsafe chars, limits to 200 chars)
- API validates file extension matches declared MIME type
- API reads file in 1MB chunks with streaming size enforcement (max 100MB)
- API rejects empty files
- API verifies the leading bytes match the declared type for binary formats (magic-byte signature check)
- API uses key: `uploads/{sanitized_filename}`
- API calls `put_object` to B2
- API extracts file metadata (checksums, image dimensions, PDF info)
- API returns `FileUploadResponse`
- Client shows toast, updates progress state, and refreshes shared data after successful uploads
- The determinate bar tracks only the browser -> API leg. Once every byte is sent the row reads "Storing in B2..." (`SERVER_PHASE_LABEL`) and the determinate bar is **replaced by an indeterminate sweeping track** (`.progress-indeterminate` in `globals.css`), because put_object + checksums + extraction can be most of the wall time — measured at 25.5s on a 54MB upload — and a bar parked at a full 100% reads as finished-but-stuck. A pulsing full bar was not enough: nothing on screen visibly moved for the whole phase. The sweep carries no percentage on purpose, since the server phase reports no progress to show
- A completed row offers "View in Files" so a finished upload doesn't dead-end
- The queue lives in `UploadQueueProvider`, so navigating away keeps it running, the header shows an "Uploading N files" indicator on every page, and the duplicate-upload guard (a disabled dropzone) stays armed

## Edge Cases
- File exceeds 100MB → client-side rejected row + toast; API returns 413 if bypassed
- File type not in allowlist → API returns 415
- File extension mismatches MIME type → API returns 415
- File contents don't match the declared type (e.g. script bytes sent as `image/png`) → API returns 415
- No filename provided → API returns 400
- Empty file → API returns 400
- Duplicate filename → B2 creates a new version (buckets are always versioned)
- B2 unreachable → API returns 500; UI keeps failed rows retryable when the file can be resubmitted
- Upload aborted by user → XHR abort, error state in UI
- Reload/close mid-upload → `beforeunload` asks for confirmation first; if it goes ahead anyway, the names of the in-flight files are kept in `sessionStorage` and the next load raises a toast ("… didn't finish uploading"), one-shot. The XHR really is dead — the point is that the loss is acknowledged instead of silent

## UX States
- Empty: dropzone with instructions
- Loading: per-file progress bars with spinner icon; a determinate "Uploading N%" while bytes move, then "Storing in B2..." with an indeterminate sweeping bar for the server-side phase
- In progress, other pages: header indicator "Uploading N files" linking to `/upload`
- Error: red status icon, error message per file, retry action when applicable
- Complete: green checkmark, "View in Files" link, "Clear finished" button
- Rejected: persistent row with non-retryable reason
- Disabled: dropzone explains that new files can be added when the current queue finishes

## Verification
- Test files: `services/api/tests/test_upload_validation.py`, `services/api/tests/test_upload_conflict.py`, `services/api/tests/test_error_handling.py`, `apps/web/src/lib/upload-status.test.ts`
- Required cases: successful upload, oversized file rejection (413), disallowed type (415), extension mismatch (415), content-signature mismatch (415), missing filename, empty file, duplicate filename allowed, `uploads_total` metric increments, status label switches to the server phase at 100%, queue summary and interrupted-upload copy
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Dev Workflows](../dev-workflows.md#commands) are available
- Pass criteria: focused tests and `pnpm verify` green; explain any skipped `pnpm verify:full` prerequisites

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Metadata Extraction](metadata-extraction.md)
- [App Workflows](../app-workflows.md)
