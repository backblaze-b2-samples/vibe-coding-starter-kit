<!-- last_verified: 2026-08-06 -->
# Feature: Metadata Extraction

## Purpose
Extract rich metadata (checksums, image/PDF fields) from stored objects, on demand. Since uploads go directly to B2, this no longer runs at upload — it is computed only when the Files browser asks for it.

## Used By
- API: `POST /upload/verify` — the direct-to-B2 upload no longer streams bytes through the API, so extraction no longer runs at upload and the verify response returns `metadata: null`
- API: `GET /files-by-key/detail?key=…` — the **only** path that returns a full `FileMetadataDetail`; recomputes it on demand for an already-stored object
- UI: the Files browser preview dialog renders it via `FileMetadataPanel`, behind a "Detailed metadata" disclosure that fetches lazily on expand (`apps/web/src/components/files/file-preview.tsx`)
- UI: the Upload page's completed rows no longer show inline extraction — the direct-to-B2 upload never streams bytes through the API, so the verify response carries `metadata: null` and `upload-progress.tsx` only offers "View in Files"

> Note: extraction is **not** persisted, and (since uploads go directly to B2) it no longer runs at upload at all — the verify response returns `metadata: null`. It is computed only on demand: the `/files-by-key/detail` endpoint re-downloads the object and re-runs extraction — so the checksums/EXIF/PDF fields cost a full object download and are size-guarded (objects above `max_file_size` are refused with 413). The cheap `GET /files-by-key/metadata` (a `head_object`) still returns only the core fields (key, size, type, uploaded-at). Persisting metadata to avoid the re-download is tracked in the tech-debt tracker.

## Core Functions
- `services/api/app/service/metadata.py` — `extract_metadata()`, `_extract_image_metadata()`, `_extract_pdf_metadata()`, `_image_warning()`
- `services/api/app/service/files.py` — `get_file_detail()` (heads for size guard, downloads, re-extracts)
- `services/api/app/repo/b2_object.py` — `get_object_bytes()` (repo-layer object download)
- `apps/web/src/components/files/file-metadata-panel.tsx` — displays metadata in structured card

## Canonical Files
- Metadata extraction pattern: `services/api/app/service/metadata.py`
- Metadata display component: `apps/web/src/components/files/file-metadata-panel.tsx`

## Inputs
- file_data: bytes
- filename: string
- content_type: string

## Outputs
- `FileMetadataDetail`: filename, size_bytes, size_human, mime_type, extension, md5, sha256, uploaded_at, metadata_warning
- `metadata_warning: str | null` — set when a format-specific extractor was **skipped or failed**, so a missing Image/PDF section is always explained. Core fields (checksums, size, type) stay exact
- Image-specific (optional): image_width, image_height, exif dict
- PDF-specific (optional): pdf_pages, pdf_author, pdf_title
- Audio/Video (optional): duration_seconds, codec, bitrate — **reserved in the model but not yet extracted**; `extract_metadata()` only populates image and PDF fields today, so these are always null

## Flow
- Extraction runs **on demand**, not at upload — the direct-to-B2 upload never streams bytes through the API
- `get_file_detail()` heads the object (rejecting >`max_file_size`), downloads it via `get_object_bytes()`, and calls `extract_metadata()` with the object's real `head_object` LastModified time
- `extract_metadata()` computes MD5 and SHA-256 hashes
- If image: opens with Pillow, extracts dimensions and EXIF data. A failure sets `metadata_warning` instead of returning nothing — a `DecompressionBombError` (image above Pillow's decode ceiling) gets a message naming that limit, anything else a generic decode message
- If PDF: opens with PyPDF2, extracts page count, author, title; a parse failure sets `metadata_warning`
- The decompression-bomb ceiling is a deliberate safety control and stays in place: oversized images are reported, never decoded
- `uploaded_at` is passed in explicitly (the stored object's LastModified) so the panel shows the true upload time rather than the recompute wall-clock time; it defaults to now only when omitted
- Returns `FileMetadataDetail`; the Files preview dialog fetches it lazily when the user expands "Detailed metadata"

## Edge Cases
- Corrupt image → image fields stay null and `metadata_warning` says the image couldn't be decoded (the warning is also logged)
- Image above Pillow's `MAX_IMAGE_PIXELS` ceiling → `DecompressionBombError`; image fields stay null and `metadata_warning` names the decode limit. The upload itself still succeeds with 200 — that is intended, but it must not look like the file simply has no dimensions
- Corrupt PDF → PDF fields stay null and `metadata_warning` says the document couldn't be parsed
- Unknown content type → only common fields populated (hashes, size, extension)
- EXIF contains binary data → decoded as UTF-8 with replace, converted to string
- Large file → hashing may be slow (computed in-memory)

## UX States
- Collapsed (default): the Files preview dialog shows a "Detailed metadata" toggle (completed upload rows no longer carry inline metadata — the verify response has `metadata: null` — so they only offer "View in Files")
- Expanded (preview): lazily fetches `/files-by-key/detail` — shows a skeleton while loading, an inline error if the recompute/download fails, then `FileMetadataPanel`
- Non-image/non-PDF file: only common fields shown (hashes, size, extension) — no image/PDF/media sections
- Skipped extraction: `FileMetadataPanel` renders `metadata_warning` as an inline note under Checksums, so "no Image section" is never unexplained

## Verification
- Test files: `services/api/tests/test_file_detail.py` (stored-object detail: checksums, image dimensions, real upload time preserved, 404, 413 size guard, and streaming-read failure wrapped as RuntimeError → 502), `services/api/tests/test_metadata_warning.py` (decodable image has no warning; bomb limit, undecodable image and unparseable PDF each report one; non-media types stay clean; the field survives the `/files-by-key/detail` response model)
- Required cases: image with EXIF, image without EXIF, PDF with metadata, PDF without metadata, unknown file type, corrupt file handling, skipped extraction reported via `metadata_warning`
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Verification](../verification.md#non-live-verification) are available
- Pass criteria: focused tests and `pnpm verify` green; explain any skipped `pnpm verify:full` prerequisites

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [File Upload](file-upload.md)
