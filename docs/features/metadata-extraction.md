<!-- last_verified: 2026-07-14 -->
# Feature: Metadata Extraction

## Purpose
Extract rich metadata from uploaded files and return it alongside upload results.

## Used By
- API: `POST /upload` (called after B2 upload) — returns the full `FileMetadataDetail` in the upload response
- UI: the Upload page renders it via `FileMetadataPanel`, behind a per-file "View details" disclosure on each completed upload (`apps/web/src/components/upload/upload-progress.tsx`)

> Note: extraction runs at upload time from the in-memory file bytes; the result is **not** persisted. The Files browser preview dialog and the by-key metadata endpoint (`GET /files-by-key/metadata`) therefore expose only the core object fields (key, size, type, uploaded-at), not checksums/EXIF. Surfacing rich metadata for already-stored files would require persisting it at upload or recomputing on demand — see the tech-debt tracker.

## Core Functions
- `services/api/app/service/metadata.py` — `extract_metadata()`, `_extract_image_metadata()`, `_extract_pdf_metadata()`
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
- Upload page stores that payload on the completed queue item and renders it in `FileMetadataPanel` under a collapsible "View details" toggle

## Edge Cases
- Corrupt image → Pillow fails silently, image fields remain null
- Corrupt PDF → PyPDF2 fails silently, PDF fields remain null
- Unknown content type → only common fields populated (hashes, size, extension)
- EXIF contains binary data → decoded as UTF-8 with replace, converted to string
- Large file → hashing may be slow (computed in-memory)

## UX States
- Collapsed (default): completed uploads show a "View details" toggle
- Expanded: `FileMetadataPanel` renders checksums, plus image/PDF fields when present
- Non-image/non-PDF file: only common fields shown (hashes, size, extension) — no image/PDF/media sections

## Verification
- Test files: `services/api/tests/` (no dedicated metadata tests yet)
- Required cases: image with EXIF, image without EXIF, PDF with metadata, PDF without metadata, unknown file type, corrupt file handling
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [File Upload](file-upload.md)
