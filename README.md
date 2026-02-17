# Vibe Coding OSS Starter Kit

Starter kit for vibe coders building apps with file uploads and object storage. This full-stack dashboard template integrates with **[Backblaze B2](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=oss-starter)** Cloud Storage and includes secure upload flows, file browsing, and basic storage management. Launch faster with a ready-to-deploy UI instead of wiring storage from scratch.

## Agent-First Architecture

This repo is optimized for coding agents. Clone it, point your agent at it, and start building.

The structure follows the principle that **repository knowledge is the system of record**. Anything an agent can't access in-context doesn't exist — so everything it needs to reason about the codebase is versioned, co-located, and discoverable from the repo itself.

### How it works

**AGENTS.md is the single source of truth for all coding agents.** A ~120 line entry point gives agents the repository layout, architectural invariants, commands, conventions, and pointers to deeper docs. Agent-specific files (CLAUDE.md, .cursorrules, etc.) are thin pointers back to AGENTS.md.

**Architecture is enforced mechanically, not by convention.** Layering rules, import boundaries, file size limits, and SDK containment are verified by structural tests and lints that run on every change. When rules are enforceable by code, agents follow them reliably.

**The knowledge base is structured for progressive disclosure:**

```
AGENTS.md              Single source of truth — layout, invariants, commands, conventions
ARCHITECTURE.md        System layout, layering rules, data flows
docs/
  product-specs/       Product specs (inputs, outputs, flows, edge cases)
  SECURITY.md          Security principles
  RELIABILITY.md       Reliability expectations
plans/                 Execution plans and reasoning artifacts
```

### Key design decisions

| Principle | Implementation |
|-----------|---------------|
| Give agents a single source of truth | AGENTS.md ~120 lines — layout, invariants, commands, conventions |
| Enforce invariants mechanically | Structural tests + ruff + ESLint verify boundaries |
| DRY documentation | Each fact lives in one place; no redundant files to drift |
| Strict layered architecture | `types -> config -> repo -> service -> runtime`, enforced by tests |
| Prefer boring, composable libraries | stdlib logging over frameworks, Pydantic over ad-hoc validation |
| Contain external SDKs | `boto3` only in `repo/` layer — verified by structural test |
| Keep files agent-sized | 300-line limit per file, enforced by test |
| Docs updated with code | Same-PR requirement prevents documentation rot |
| Structured observability | JSON logging, `/metrics` endpoint, request tracing |

This approach draws from [OpenAI's experience building with Codex](https://openai.com/index/harness-engineering/): agents work best in environments with strict boundaries, predictable structure, and progressive context disclosure.

## Core Features

**Application**
- [File Upload](docs/product-specs/file-upload.md) — drag-and-drop upload with real-time progress
- [File Browser](docs/product-specs/file-browser.md) — list, preview, download, delete files
- [Dashboard](docs/product-specs/dashboard.md) — stats cards, upload chart, recent uploads
- [Metadata Extraction](docs/product-specs/metadata-extraction.md) — image dimensions, EXIF, PDF info, checksums

**Quality & Observability**
- Structural tests — verify layering rules, import boundaries, SDK containment, file size limits
- Integration tests — health endpoint and metrics endpoint via async test client
- E2E tests — Playwright scaffolding for browser-driven smoke tests
- Backend linting — ruff with strict rules (no `print()`, import ordering, bugbear)
- Frontend linting — ESLint with strict equality, no unused vars, no console
- Pre-commit hooks — ruff + format checks + file size limits on every commit
- Structured JSON logging — every request traced with `request_id` and timing
- `/health` endpoint — B2 connectivity check
- `/metrics` endpoint — Prometheus-format counters (request count, latency, uploads)

## Tech Stack

- TypeScript, Next.js 16, React 19, Tailwind v4, shadcn/ui, Recharts
- Python 3.11+, FastAPI, boto3, Pydantic v2, Pillow, PyPDF2
- Backblaze B2 (S3-compatible object storage)
- pnpm workspaces (monorepo)

## Get Running in 5 Minutes

You need: Node.js >= 20, pnpm >= 9, Python >= 3.11, and a free **[Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=oss-starter)**.

**1. Clone and install**

```bash
git clone https://github.com/backblaze-b2-samples/vibe-coding-starter-kit.git
cd vibe-coding-starter-kit
pnpm install
```

**2. Set up the backend**

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd ../..
```

**3. Add your B2 credentials**

Create a bucket and an application key in your [B2 dashboard](https://secure.backblaze.com/b2_buckets.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=oss-starter) (the key needs `readFiles`, `writeFiles`, `deleteFiles` permissions), then:

```bash
cp .env.example .env
```

Fill in your `.env`:

```
B2_S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_APPLICATION_KEY_ID=your-key-id
B2_APPLICATION_KEY=your-key
B2_BUCKET_NAME=your-bucket
```

**4. Run it**

```bash
pnpm dev
```

That's it. Frontend at `localhost:3000`, API at `localhost:8000`. Upload a file and see it working.

For production deployment, see [Railway docs](infra/railway/README.md).

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start frontend + backend |
| `pnpm dev:web` | Frontend only |
| `pnpm dev:api` | Backend only |
| `pnpm build` | Build frontend |
| `pnpm lint` | Lint frontend |
| `pnpm lint:api` | Lint backend (ruff) |
| `pnpm test:api` | Run backend tests |
| `pnpm check:structure` | Verify layering rules |
| `pnpm test:e2e` | Playwright e2e tests |

## Contributing

Start with [AGENTS.md](AGENTS.md). It's the map — everything else is discoverable from there.

## License

MIT License - see [LICENSE](LICENSE) for details.
