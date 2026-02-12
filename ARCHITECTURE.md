# Architecture

## Components

- **apps/web/** — Next.js 15 frontend (App Router, Tailwind v4, shadcn/ui)
  - Dashboard with stats, upload chart, recent uploads
  - File upload with drag-and-drop, progress tracking
  - File browser with preview, download, delete
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend
  - REST API for file upload, listing, deletion
  - B2 S3 integration via boto3
  - File metadata extraction (images, PDFs)
  - Health check endpoint with B2 connectivity verification
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API
  - Consumed by `apps/web/` as workspace dependency

## Deployment

- **Local dev** — `pnpm dev` runs both services via `concurrently`
  - Web: `localhost:3000`
  - API: `localhost:8000`
- **Railway** — two services from the same repo
  - See `infra/railway/README.md` for configuration

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API)
  - All uploaded files stored in a single bucket
  - File listing and metadata via S3 `list_objects_v2` / `head_object`
  - No application database — B2 is the sole data store

## External Services

- **Backblaze B2 S3 API** — file storage, retrieval, deletion, presigned URLs

## Trust Boundaries

- **Frontend → API** — CORS-restricted, origin allowlist via `API_CORS_ORIGINS`
- **API → B2** — authenticated via `B2_APPLICATION_KEY_ID` + `B2_APPLICATION_KEY`, signature v4
- **Client → B2** — presigned URLs for direct download (time-limited)

## Data Flows

- **Upload**: Browser → `POST /upload` (multipart) → API validates size/type → `put_object` to B2 → metadata extracted → response with file info + metadata
- **List**: Browser → `GET /files` → API calls `list_objects_v2` → returns file list
- **Download**: Browser → `GET /files/{key}/download` → API generates presigned URL → browser redirects to B2
- **Delete**: Browser → `DELETE /files/{key}` → API calls `delete_object` on B2

## Core Features

- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)
- [Dashboard](docs/features/dashboard.md)
- [Metadata Extraction](docs/features/metadata-extraction.md)
