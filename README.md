# OSS Starter Kit

Full-stack file management dashboard for **Backblaze B2** via S3-compatible API. Built for developers who need a ready-to-deploy upload and storage UI.

## Core Features

- [File Upload](docs/features/file-upload.md) — drag-and-drop upload with real-time progress
- [File Browser](docs/features/file-browser.md) — list, preview, download, delete files
- [Dashboard](docs/features/dashboard.md) — stats cards, upload chart, recent uploads
- [Metadata Extraction](docs/features/metadata-extraction.md) — image dimensions, EXIF, PDF info, checksums

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full system layout.

- **apps/web/** — Next.js 15 frontend (App Router, Tailwind v4, shadcn/ui)
- **services/api/** — FastAPI backend (boto3 → B2 S3)
- **packages/shared/** — shared TypeScript types
- **infra/railway/** — deployment instructions

## Tech Stack

- TypeScript, Next.js 15, React 19, Tailwind v4, shadcn/ui, Recharts
- Python 3.11+, FastAPI, boto3, Pydantic v2, Pillow, PyPDF2
- Backblaze B2 (S3-compatible object storage)
- pnpm workspaces (monorepo)

## Setup

### Prerequisites

- Node.js >= 20, pnpm >= 9
- Python >= 3.11
- Backblaze B2 account with a bucket + application key

### Install

```bash
git clone <repo-url> && cd oss-starter-kit
pnpm install
cd services/api && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

### Environment Variables

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `B2_S3_ENDPOINT` | B2 S3-compatible endpoint URL |
| `B2_APPLICATION_KEY_ID` | B2 application key ID |
| `B2_APPLICATION_KEY` | B2 application key secret |
| `B2_BUCKET_NAME` | Target bucket name |

The frontend auto-connects to `http://localhost:8000` in dev. For production, set `NEXT_PUBLIC_API_URL` on the web service (see [Railway docs](infra/railway/README.md)).

## Run Commands

- `pnpm dev` — start both frontend and backend
- `pnpm dev:web` — frontend only
- `pnpm dev:api` — backend only
- `pnpm build` — build frontend

## Test Commands

- `pnpm lint` — lint frontend
- `pnpm build` — type check + build
- No test suites exist yet — test harness setup is pending

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system layout, data flows, trust boundaries
- [docs/app-workflows.md](docs/app-workflows.md) — user journeys
- [docs/dev-workflows.md](docs/dev-workflows.md) — engineering workflows
- [docs/features/](docs/features/) — feature specifications
- [AGENTS.md](AGENTS.md) — coding agent rules and conventions

## Contributing

See [AGENTS.md](AGENTS.md) for coding conventions, documentation rules, and PR requirements.

## License

MIT License - see [LICENSE](LICENSE) for details.
