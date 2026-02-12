# Feature: Metadata Extraction

## Purpose
Extract rich metadata from uploaded files and return it alongside upload results.

## Used By
- API: `POST /upload` (called after B2 upload)
- UI: upload results, file metadata panel

## Core Functions
- `services/api/app/services/metadata.py` — `extract_metadata()`, `_extract_image_metadata()`, `_extract_pdf_metadata()`
- `apps/web/src/components/files/file-metadata-panel.tsx` — displays metadata in structured card

## Inputs
- file_data: bytes
- filename: string
- content_type: string

## Outputs
- `FileMetadataDetail`: filename, size_bytes, size_human, mime_type, extension, md5, sha256, uploaded_at
- Image-specific (optional): image_width, image_height, exif dict
- PDF-specific (optional): pdf_pages, pdf_author, pdf_title
- Audio/Video (optional): duration_seconds, codec, bitrate

## Flow
- Upload route receives file and stores in B2
- `extract_metadata()` called with file bytes, filename, content type
- Computes MD5 and SHA-256 hashes
- If image: opens with Pillow, extracts dimensions and EXIF data
- If PDF: opens with PyPDF2, extracts page count, author, title
- Returns `FileMetadataDetail` model
- Frontend displays metadata in file-metadata-panel component

## Edge Cases
- Corrupt image → Pillow fails silently, image fields remain null
- Corrupt PDF → PyPDF2 fails silently, PDF fields remain null
- Unknown content type → only common fields populated (hashes, size, extension)
- EXIF contains binary data → decoded as UTF-8 with replace, converted to string
- Large file → hashing may be slow (computed in-memory)

## UX States
- Not applicable (metadata is part of upload response and file preview)

## Tests
- No test harness yet
- Required cases: image with EXIF, image without EXIF, PDF with metadata, PDF without metadata, unknown file type, corrupt file handling

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [File Upload](file-upload.md)
- [App Workflows](../app-workflows.md)
