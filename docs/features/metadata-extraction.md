<!-- last_verified: 2026-07-20 -->
# Feature: Metadata Extraction

## Purpose
Extract rich metadata from uploaded files and surface it both at upload time and for already-stored objects.

## Used By
- API: `POST /upload` (called after B2 upload) — returns the full `FileMetadataDetail` in the upload response
- API: `GET /files-by-key/detail?key=…` — recomputes `FileMetadataDetail` on demand for an already-stored object
- UI: the Upload page renders it via `FileMetadataPanel`, behind a per-file "View details" disclosure on each completed upload (`apps/web/src/components/upload/upload-progress.tsx`)
- UI: the Files browser preview dialog renders it via `FileMetadataPanel`, behind a "Detailed metadata" disclosure that fetches lazily on expand (`apps/web/src/components/files/file-preview.tsx`)

> Note: extraction is **not** persisted. At upload it runs from the in-memory bytes and is returned inline. For an already-stored object the `/files-by-key/detail` endpoint re-downloads the object and re-runs extraction on demand — so the checksums/EXIF/PDF fields cost a full object download and are size-guarded (objects above `max_file_size` are refused with 413). The cheap `GET /files-by-key/metadata` (a `head_object`) still returns only the core fields (key, size, type, uploaded-at). Persisting metadata at upload to avoid the re-download is tracked in the tech-debt tracker.

## Core Functions
- `services/api/app/service/metadata.py` — `extract_metadata()`, `_extract_image_metadata()`, `_extract_pdf_metadata()`
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
- `FileMetadataDetail`: filename, size_bytes, size_human, mime_type, extension, md5, sha256, uploaded_at
- Image-specific (optional): image_width, image_height, exif dict
- PDF-specific (optional): pdf_pages, pdf_author, pdf_title
- Audio/Video (optional): duration_seconds, codec, bitrate — **reserved in the model but not yet extracted**; `extract_metadata()` only populates image and PDF fields today, so these are always null

## Flow
- Upload route receives file and stores in B2
- `extract_metadata()` called with file bytes, filename, content type
- Computes MD5 and SHA-256 hashes
- If image: opens with Pillow, extracts dimensions and EXIF data
- If PDF: opens with PyPDF2, extracts page count, author, title
- Returns `FileMetadataDetail` model in the `metadata` field of the upload response
- `uploaded_at` is passed in explicitly (the fresh upload time, or a stored object's `head_object` LastModified) so the panel shows the true upload time rather than the recompute wall-clock time; it defaults to now only when omitted
- Upload page stores that payload on the completed queue item and renders it in `FileMetadataPanel` under a collapsible "View details" toggle
- For a stored object: `get_file_detail()` heads the object (rejecting >`max_file_size`), downloads it via `get_object_bytes()`, and re-runs `extract_metadata()` with the object's real upload time; the Files preview dialog fetches this lazily when the user expands "Detailed metadata"

## Edge Cases
- Corrupt image → Pillow fails silently, image fields remain null
- Corrupt PDF → PyPDF2 fails silently, PDF fields remain null
- Unknown content type → only common fields populated (hashes, size, extension)
- EXIF contains binary data → decoded as UTF-8 with replace, converted to string
- Large file → hashing may be slow (computed in-memory)

## UX States
- Collapsed (default): completed uploads show a "View details" toggle; the Files preview dialog shows a "Detailed metadata" toggle
- Expanded (upload): `FileMetadataPanel` renders checksums, plus image/PDF fields when present (data already in hand)
- Expanded (preview): lazily fetches `/files-by-key/detail` — shows a skeleton while loading, an inline error if the recompute/download fails, then `FileMetadataPanel`
- Non-image/non-PDF file: only common fields shown (hashes, size, extension) — no image/PDF/media sections

## Verification
- Test files: `services/api/tests/test_file_detail.py` (stored-object detail: checksums, image dimensions, real upload time preserved, 404, 413 size guard, and streaming-read failure wrapped as RuntimeError → 502)
- Required cases: image with EXIF, image without EXIF, PDF with metadata, PDF without metadata, unknown file type, corrupt file handling
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [File Upload](file-upload.md)
