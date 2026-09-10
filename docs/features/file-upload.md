<!-- last_verified: 2026-08-06 -->
# Feature: File Upload

## Purpose
Upload files from the browser **directly to Backblaze B2** with real-time
progress tracking. The bytes never pass through the API, so uploads are not
capped by Vercel's ~4.5 MB Function payload limit — the same flow handles up to
`max_file_size` (100 MB default) on local, Railway, and Vercel alike, and is a
direct showcase of B2 as the storage layer.

## Used By
- UI: `/upload` page, upload form component
- API: `POST /upload/presign`, `POST /upload/verify`

## Core Functions
- `apps/web/src/lib/upload-queue-context.tsx` — `UploadQueueProvider` / `useUploadQueue()`: the app-wide upload queue. Mounted in the root layout, so an upload survives navigation away from `/upload`
- `apps/web/src/lib/upload-status.ts` — `UploadItem`, `uploadStatusLabel()`, `isServerPhase()`, `uploadQueueSummary()`, `activeUploadLabel()`, `interruptedUploadMessage()`
- `apps/web/src/components/upload/upload-form.tsx` — thin view over the provider (dropzone + progress + clear)
- `apps/web/src/components/upload/dropzone.tsx` — drag-and-drop via `react-dropzone`
- `apps/web/src/components/upload/upload-progress.tsx` — per-file progress, errors, retry, a "View in Files" hand-off on completed rows
- `apps/web/src/components/layout/header.tsx` — app-wide "Uploading N files" indicator linking back to `/upload`
- `apps/web/src/lib/api-client.ts` — `uploadFile()`: presign → direct browser→B2 PUT (XHR for progress) → verify
- `services/api/app/runtime/upload.py` — `POST /upload/presign` and `POST /upload/verify` handlers
- `services/api/app/service/upload.py` — declared-upload validation, presign, and post-upload verification
- `services/api/app/repo/b2_upload.py` — `generate_presigned_upload()` (signed PUT), `get_object_head_bytes()` (Range sniff), `invalidate_listing()`
- `services/api/app/service/metadata.py` — `extract_metadata()`, now only via `/files-by-key/detail` (not at upload)

## Canonical Files
- Presign/verify handler pattern: `services/api/app/runtime/upload.py`
- Service orchestration pattern: `services/api/app/service/upload.py`
- Frontend upload flow: `apps/web/src/lib/upload-queue-context.tsx` + `uploadFile()` in `apps/web/src/lib/api-client.ts`

## Inputs
- Presign: `{ filename, content_type, size_bytes }` (JSON)
- Direct PUT: the raw file bytes to the signed B2 URL (never through the API)
- Verify: `{ key }` (JSON)

## Outputs
- Presign → `PresignUploadResponse`: `key`, `url`, `method`, `content_type`, `headers`, `expires_in`
- Verify → `FileUploadResponse`: `key`, `filename`, `size_bytes`, `size_human`, `content_type`, `uploaded_at`, `url`, `metadata` (**null at upload** — rich extraction is recomputed on demand via `/files-by-key/detail`)
- Side effects: file stored in B2 under `uploads/{sanitized_filename}` by the browser; the shared listing cache is invalidated on verify so the object appears in `/files` and `/files/stats`

## Supported File Types
The allow-list is the `ALLOWED_TYPES` / `MIME_EXTENSION_MAP` in `services/api/app/service/upload.py` (source of truth), mirrored client-side in `apps/web/src/lib/upload-file-types.ts`; a vitest drift guard (`upload-file-types.test.ts`) fails if the two sets diverge. Current categories:
- **Images**: JPEG, PNG, GIF, WebP (`image/svg+xml` deliberately excluded — stored-XSS risk)
- **Documents**: PDF; Office OOXML — `.docx`, `.xlsx`, `.pptx`
- **Text / data**: plain text (`.txt`/`.text`/`.log`), Markdown (`.md`/`.markdown`), CSV, TSV, JSON, NDJSON/JSON Lines (`.jsonl`/`.ndjson`), YAML (`.yaml`/`.yml`), XML
- **Archives**: ZIP
- **Video**: MP4, QuickTime (`.mov`), WebM
- **Audio**: MP3, WAV

**Browser-MIME caveat**: the server gates on the browser-declared `Content-Type` at presign time. Some OSes/browsers send `application/octet-stream` (or an empty type) for less-common extensions such as `.jsonl`, `.tsv`, or `.yaml`, which are not on the allow-list and are rejected with 415. Adding an extension→MIME fallback for `octet-stream` uploads is tracked as a follow-up and intentionally out of scope here.

## Validation split (why it still holds without the proxy)
The bytes never reach the API, yet every check the old proxy did is preserved:
- **Size**: signed into the presigned PUT as `Content-Length`; B2 rejects any other size with `403`. The API refuses to presign a declared size above `max_file_size`. Prevented, not just detected.
- **Declared content-type**: signed into the PUT; the browser must send it verbatim.
- **Allow-list + extension↔type**: enforced at presign from the declared filename + type.
- **Object key**: minted by the API (`uploads/{sanitised}`); the client never chooses it.
- **Magic-byte sniff**: at verify, for types that have a signature (images, PDF, zip, mp4, mp3, wav — text/data/OOXML types skip it), a `Range: bytes=0-511` GET re-runs the signature check on the real leading bytes — cheap even for a 100 MB object. A mismatch deletes the object and returns 415.

**Security note**: `verify` is **best-effort** — the browser is trusted to call it. A client that PUTs but never calls verify leaves the object in place, and the periodic bucket scan will eventually list it. The controls that do **not** depend on verify are the ones carrying the weight: the presign allow-list rejects HTML/SVG outright, and the **signed content-type** means the object is always stored and served as an allow-listed, non-executable type — so a spoofed payload can't be served as HTML/script. The magic-byte sniff at verify is defense-in-depth on top of that. To make byte-level validation **unconditional**, enable the quarantine→promote hardening in the design plan (upload to a `pending/` prefix, promote to `uploads/` only after verify).

## Flow
- User drops or selects files in the dropzone
- Client validates file size (max 100MB) and type — rejected files remain in the queue with a clear reason and show toast feedback
- Client POSTs `{ filename, content_type, size_bytes }` to `/upload/presign`
- API validates the declared upload (allow-list, extension↔type, size ≤ max, non-empty), mints the key `uploads/{sanitized_filename}`, and returns a presigned PUT with `Content-Length` and `Content-Type` signed in
- Browser PUTs the raw bytes **directly to B2** with the signed URL (XHR for progress events); bytes never traverse the API Function
- Client POSTs `{ key }` to `/upload/verify`
- API HEADs the object (size/type), then Range-GETs the leading bytes and re-runs the magic-byte signature check; anything invalid is deleted and returns 413/415
- API invalidates the listing cache and returns `FileUploadResponse`
- Client shows toast, updates progress state, and refreshes shared data after successful uploads
- The determinate bar tracks only the browser → B2 PUT leg. Once every byte is sent the row reads "Verifying upload..." (`SERVER_PHASE_LABEL`) and the determinate bar is **replaced by an indeterminate sweeping track** (`.progress-indeterminate` in `globals.css`) while the API HEADs + sniffs the object, because a bar parked at a full 100% reads as finished-but-stuck
- A completed row offers "View in Files" so a finished upload doesn't dead-end
- The queue lives in `UploadQueueProvider`, so navigating away keeps it running, the header shows an "Uploading N files" indicator on every page, and the duplicate-upload guard (a disabled dropzone) stays armed

## B2 bucket CORS
Because the browser PUTs directly to B2, the bucket must allow the web origin
(method `PUT` + the `content-type` header). Local dev origins are typically
already allowed. For a deployed origin, run once:

```bash
python services/api/scripts/setup_b2_cors.py --origin https://your-app.vercel.app --apply
```

See [infra/vercel/README.md](../../infra/vercel/README.md) for the deploy-time details.

## Edge Cases
- File exceeds 100MB → client-side rejected row + toast; `/upload/presign` returns 413 if bypassed
- File type not in allowlist → `/upload/presign` returns 415
- File extension mismatches MIME type → `/upload/presign` returns 415
- No filename provided → `/upload/presign` returns 400
- Empty file → `/upload/presign` returns 400
- B2 rejects the direct PUT because the body size/type differs from the signed values → `403`, surfaced in the UI as "Upload to storage failed"
- File contents don't match the declared type (e.g. script bytes sent as `image/png`) → `/upload/verify` returns 415 and the object is deleted
- Verify called with a key outside the `uploads/` prefix → 400
- Duplicate filename → B2 creates a new version (buckets are always versioned)
- B2 unreachable → API returns 500; UI keeps failed rows retryable when the file can be resubmitted
- Upload aborted by user → XHR abort, error state in UI
- Reload/close mid-upload → `beforeunload` asks for confirmation first; if it goes ahead anyway, the names of the in-flight files are kept in `sessionStorage` and the next load raises a toast ("… didn't finish uploading"), one-shot

## UX States
- Empty: dropzone with instructions
- Loading: per-file progress bars with spinner icon; a determinate "Uploading N%" while bytes move to B2, then "Verifying upload..." with an indeterminate sweeping bar for the server-side verify phase
- In progress, other pages: header indicator "Uploading N files" linking to `/upload`
- Error: red status icon, error message per file, retry action when applicable
- Complete: green checkmark, "View in Files" link, "Clear finished" button
- Rejected: persistent row with non-retryable reason
- Disabled: dropzone explains that new files can be added when the current queue finishes

## Verification
- Test files: `services/api/tests/test_upload_validation.py`, `services/api/tests/test_upload_conflict.py`, `services/api/tests/test_error_handling.py`, `apps/web/src/lib/upload-status.test.ts`
- Required cases: presign validation rejections (413 oversized, 415 disallowed type / extension mismatch, 400 empty/no filename), presign returns a signed PUT, verify accepts a valid object, verify rejects + deletes on content-signature mismatch (415) and oversize (413), verify 404 on missing object, verify rejects a key outside `uploads/`, `uploads_total` metric increments on verify, status label switches to the server phase at 100%, queue summary and interrupted-upload copy
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Verification](../verification.md#non-live-verification) are available
- Pass criteria: focused tests and `pnpm verify` green; explain any skipped `pnpm verify:full` prerequisites

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [Metadata Extraction](metadata-extraction.md)
- [App Workflows](../app-workflows.md)
- [Design plan: presigned direct upload](../exec-plans/active/2026-08-06-presigned-direct-upload.md)
