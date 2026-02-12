# Vibe Coding OSS Starter Kit

Starter kit for vibe coders building apps with file uploads and object storage. This full-stack dashboard template integrates with **[Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=oss-starter)** Cloud Storage and includes secure upload flows, file browsing, and basic storage management. Launch faster with a ready-to-deploy UI instead of wiring storage from scratch.

## Vibe Coding Ready

This repo is designed for AI-assisted development. Clone it, point your coding agent at it, and start building.

- **[CLAUDE.md](CLAUDE.md)** — tells Claude Code (and compatible agents) the project structure, doc read order, test commands, and coding conventions. Your agent understands the codebase from the first prompt.
- **[AGENTS.md](AGENTS.md)** — rules for any coding agent: file naming, commit style, doc update requirements, PR checklist. Keeps AI-generated code consistent with the rest of the project.

The feature docs in `docs/features/` give agents full context on each module — inputs, outputs, flows, edge cases — so they can add features or fix bugs without guessing.

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
- **[Backblaze B2 Account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=oss-starter)** (free tier available)
  - Create a bucket
  - Generate an Application Key with `readFiles`, `writeFiles` permissions

### Install

```bash
git clone https://github.com/backblaze-b2-samples/vibe-coding-starter-kit.git && cd oss-starter-kit
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
