<!-- last_verified: 2026-05-28 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Intelligence dashboard: cluster grid, category breakdown, activity timeline, spec depth
  - Snapshot management: trigger, list, drill-down per snapshot
  - File upload with drag-and-drop, progress tracking
  - File browser with preview, download, delete
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - Issue intelligence pipeline: ingest → embed → classify → cluster → analyze
  - REST API for file upload, listing, deletion
  - B2 S3 integration via boto3
  - File metadata extraction (images, PDFs)
  - Health check endpoint with B2 connectivity verification
  - Structured JSON logging with request tracing
  - Prometheus-format metrics endpoint
- **packages/shared/** — TypeScript type definitions
  - Mirrors Pydantic models from the API
  - Consumed by `apps/web/` as workspace dependency

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access (boto3 B2 client) — no business logic
  |
service/   Business logic — calls repo, returns types
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` layer
4. All boundary data uses Pydantic models (no raw dicts across layers)
5. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (FileMetadata, Issue, SnapshotReport, etc.)
    config/                Settings loaded from environment
    repo/                  Data access: B2, GitHub, embedding, LLM clients
    service/               Business logic: upload, files, ingestion, classification, clustering
    service/prompts/       LLM prompt templates (versioned in repo)
    runtime/               FastAPI route handlers + CLI entry points
  tests/                   pytest tests (structural + integration)
```

## Boundary Invariants

- **No external SDK leakage**: `boto3` (B2), `openai` (embeddings), and `anthropic` (LLM) are only imported in `app/repo/`. All other layers interact through the repo interface.
- **No raw dicts at boundaries**: All data crossing layer boundaries uses typed Pydantic models.
- **No mutable globals**: Configuration is read-only after init. No module-level mutable state shared between layers.
- **Validated inputs**: All HTTP inputs validated by FastAPI/Pydantic. All file keys validated against prefix allowlist.

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

- **Backblaze B2 S3 API** — file storage, retrieval, deletion, presigned URLs; intelligence pipeline snapshots
- **GitHub REST API** — issue fetch (read-only, fine-grained PAT)
- **OpenAI API** — text embeddings (`text-embedding-3-small`)
- **Anthropic API** — issue classification and cluster labeling (`claude-3-5-haiku-20241022`)

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins
- **API -> B2** — authenticated via application keys, signature v4
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Upload**: Browser -> `POST /upload` (multipart) -> API validates -> service orchestrates -> repo writes to B2 -> metadata extracted -> response
- **List**: Browser -> `GET /files` -> service calls repo -> returns file list
- **Download**: Browser -> `GET /files/{key}/download` -> service validates key -> repo generates presigned URL -> browser downloads
- **Delete**: Browser -> `DELETE /files/{key}` -> service validates key -> repo deletes from B2
- **Intelligence pipeline**: `POST /api/intelligence/snapshots` -> BackgroundTasks -> ingest (GitHub) -> embed (OpenAI) -> classify (Anthropic) -> cluster (HDBSCAN + Anthropic) -> analyze -> SnapshotReport in B2
- **Dashboard**: Browser -> `GET /api/intelligence/snapshots/:id` -> reads SnapshotReport from B2 -> React renders ClusterGrid, charts

Intelligence B2 layout: `intelligence/raw/issues/snapshot=<ts>/` + `intelligence/derived/{embeddings,classifications,clusters,reports}/snapshot=<ts>/`. See [docs/features/storage-layout.md](docs/features/storage-layout.md).

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware (logs duration per request)
- `/metrics` endpoint (Prometheus format: request count, latency, upload count)
- `/health` endpoint (B2 connectivity check)

## Canonical Files

- Layered API handler: `services/api/app/runtime/upload.py`
- Service orchestration: `services/api/app/service/upload.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Pydantic models: `services/api/app/types/` (`files.py`, `upload.py`, `stats.py`, `formatting.py`)
- Config (pydantic-settings): `services/api/app/config/settings.py`
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Intelligence Pipeline](docs/features/intelligence.md)
- [Intelligence Dashboard](docs/features/intelligence-dashboard.md)
- [Storage Layout](docs/features/storage-layout.md)
- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)
- [Metadata Extraction](docs/features/metadata-extraction.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
