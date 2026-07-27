<!-- last_verified: 2026-07-27 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

## Open

| Description | Impact | Proposed Resolution | Priority |
|---|---|---|---|
| Download counter & `/metrics` not durable across restart/replicas | Counter resets on redeploy (ephemeral FS); both fragment across replicas | Back the counter with a shared store (Redis/DB); label/aggregate metrics per instance. Relocated to `repo/counter.py` and documented in RELIABILITY.md | Medium |
| Upload buffers the whole file in memory | ~3× file size RAM per upload; large files strain the server (event loop no longer blocked, but memory unbounded) | Stream to a temp file, or S3 multipart above a size threshold | Medium |
| `GET /files-by-key/detail` re-downloads the whole object to recompute metadata | Rich metadata for stored files costs a full download + in-memory hash per preview; large objects are slow/expensive and buffer in API memory | Persist `FileMetadataDetail` at upload (S3 user-metadata, mind the ~2KB cap, or a sidecar/object store) and serve it without re-downloading; add a size ceiling above which detail is skipped | Medium |
| Audio/Video metadata fields declared but never extracted | `duration_seconds`/`codec`/`bitrate` always null; real extraction needs a system dependency (ffmpeg/ffprobe or libmediainfo), not a pip-only lib | Add an audio/video extractor in `service/metadata.py`, or drop the fields from `FileMetadataDetail` | Low |
| `get_upload_activity` re-materializes `FileMetadata` for every object just to bucket dates | Wasted O(n) CPU per `/files/stats/activity` (scan is cached; materialization is not) | Aggregate from raw listing dicts like `get_upload_stats` does | Low |
| Frontend has no component/render tests; e2e only checks routing | UI states (loading/error/empty) and the real upload→delete journey are unverified | Add jsdom + @testing-library/react render tests; a fixture-driven upload e2e | Medium |
| Allowed file types hardcoded in `service/upload.py` | Reuse friction — each new app edits source to change accepted types | Make `ALLOWED_TYPES` / `MIME_EXTENSION_MAP` env-configurable | Low |
| No auth layer or placeholder | Every consumer designs auth from scratch; unclear where it plugs in | Add example middleware (API-key or JWT) + docs for the seam | Low |
| No `docker-compose.yaml` | Manual venv + dual-process startup slows first run | Add compose with `web` + `api` services and Dockerfiles | Low |
| `api-client.ts` hand-synced to FastAPI | Endpoint drift between client and server | Note an OpenAPI codegen strategy or link the spec | Low |
| No dedicated connection-status banner | Offline only surfaced reactively per failed query | Add a global connectivity banner (route + global error boundaries already exist) | Low |
| `e2e/**` and `playwright.config.ts` are excluded from `apps/web/tsconfig.json` | Neither `pnpm typecheck` nor `next build` typechecks the E2E specs, and `pnpm test:e2e` is not in CI — type errors there can sit undetected indefinitely | Add a dedicated `tsconfig.e2e.json` and typecheck it in `pnpm verify:web`, or drop the exclude | Low |
| No tests for the ~545 lines of enforcement logic in `scripts/check-agent-docs.mjs` + `scripts/agent-docs/*.mjs`, against AGENTS.md §4 ("tests for every behavior change") | Seven AGENTS.md §5 rules now name this script as their enforcer, and its own comments record six fixed false-greens (`env-ignore.mjs:6`, `:11`, `check-agent-docs.mjs:63`, `:127`, `:213`, plus folded `run: >` scalars in `workflow.mjs:22`) — the next regression is silent again | Decide the harness: no precedent exists for testing `scripts/` (`doctor.mjs`, `pick-port.mjs` are untested), so this needs a small `node:test` runner over fixture repos, wired into `pnpm verify` as its own gate | Medium |
| `scripts/agent-docs/workflow.mjs:17,128` — `RUN_KEY` matches `run:` at any indentation (including under `with:`), and `readBlockScalar` does not advance the loop index, so block content is re-scanned as top-level lines | Non-executing text can satisfy "CI runs X". Verified with the real `run: pnpm verify:web` step deleted: both a heredoc containing `run: pnpm verify:web` and a `with:` input named `run` pass at exit 0 / 74 checks. Medium only because plain deletion of the job *is* caught | Anchor `run:` to step-level indentation (a `-` list item under `steps:`) and return the consumed line count from `readBlockScalar` so the loop skips past it | Medium |
| `scripts/agent-docs/env-ignore.mjs:36` — `isRepoIgnoreSource` validates the path *shape*, not that the `.gitignore` is tracked, while every message says "repo-tracked" | Verified both directions with an untracked `services/api/.gitignore` containing `.env.*`: false failure (`services/api/.env.example remains trackable — actual ignored`), and, with the root env section deleted, a false pass that is green locally and broken in a fresh clone | Confirm the matching source with `git ls-files --error-unmatch <source>`, or drop "repo-tracked" from the wording | Medium |
| `scripts/agent-docs/workflow.mjs:173` (`checkGateClaims`) — the package.json and CI-claims assertions are presence-only, so a neutered gate still satisfies them | A job disabled with `if: false` still satisfies "declares job X" / "runs X", and `"verify": "pnpm check:agent-docs && pnpm verify:api \|\| true && pnpm verify:web"` still satisfies every composition assertion — both verified at exit 0 / 74 checks. Needs deliberate neutering rather than deletion | Reject `if: false` (and equivalent always-false conditions) on the asserted jobs, and reject short-circuit operators (`\|\|`, `;`, `& `) inside the verify chains | Medium |
| `.github/workflows/ci.yml:4-5` — the header comment holds the only verbatim copy of the verify chain, and `scripts/agent-docs/workflow.mjs` strips comments before parsing by design | `docs/dev-workflows.md` makes `package.json` the single source of truth for the literal chain, so this last hand-maintained copy is permanently invisible to the guard and has already needed a hand edit once | Drop the `=` expansion from the comment and point at `package.json` instead | Low |
| `README.md:31` and `README.md:53` call AGENTS.md a "~100 line" entry point | It is 180 lines and the guard's ceiling is 250 — the claims disagree by ~2x, so an agent trusting the README under-budgets the file it is told to read first | Replace both with the guard's real ceiling, or drop the line count | Low |

## Resolved

| Description | Resolution |
|---|---|
| Rich metadata (checksums/EXIF/PDF) unavailable for already-stored files | `GET /files-by-key/detail` recomputes `FileMetadataDetail` on demand from the object bytes; `FileMetadataPanel` mounted in the Files preview dialog behind a lazy "Detailed metadata" disclosure |
| Blocking boto3 in `async def` handlers froze the single event loop | B2 handlers are sync `def` (Starlette threadpool); upload offloads via `run_in_threadpool` |
| Full-bucket scan on every list/stats/activity request, uncached | Short-TTL cache in `repo/b2_client._list_all_objects`, invalidated on upload/delete |
| No CI — quality gates ran only when a human remembered | `.github/workflows/ci.yml` runs all three `pnpm verify` gates — `check:agent-docs`, `verify:api`, `verify:web` — as parallel jobs on PR and push to `main` |
| SVG stored-XSS; declared MIME trusted; unused `python-magic` dep | Dropped SVG from allow-list; added magic-byte signature check; removed dead `python-magic` |
| No rate limiting → DoS + B2 cost amplification | Per-IP fixed-window limiter (`runtime/ratelimit.py`), read/write budgets |
| Counter persistence lived in the service layer (layering violation) | Moved file I/O to `repo/counter.py` behind `get/increment_download_count` |
| CORS `allow_credentials=True` with no auth + regex escape hatch | Default `allow_credentials=False`; empty origins filtered |
| No security headers on API responses | `X-Content-Type-Options: nosniff` + `Referrer-Policy: no-referrer` on every response |
| Key-addressed ops could target any bucket object | Opt-in `ALLOWED_KEY_PREFIX` confinement (off by default, preserves arbitrary-key routes) |
| Redundant triple-scan + double sort per dashboard mount | TTL cache + single-flight collapse the concurrent empty-prefix scans; dropped the repo-layer sort so `get_files` owns newest-first ordering once |
| Unguarded `int(content-length)`; public `/docs`; uncached `/health` B2 call | Content-Length parse guarded; `ENABLE_DOCS` toggle; connectivity cached ~5s |
| Upload validation sad-paths (413/415) + sanitizer untested | `tests/test_upload_validation.py` covers the rejection matrix, signature, `uploads_total` |
| FastAPI `/docs` & `/redoc` undocumented | Documented in README; `ENABLE_DOCS` toggle added |
| `NEXT_PUBLIC_API_URL` missing from `.env.example` | Added with guidance |
| `get_upload_stats()` / `list_files()` object listing capped at 1000 | Shared `_list_all_objects()` paginator follows `ContinuationToken` |
| `datetime.utcnow()` deprecated in Python 3.12+ | Replaced with `datetime.now(UTC)` |
| S3 client recreated on every API call | Cached module-level singleton via `lru_cache` |
| `record_upload()` never called | Called from `runtime/upload.py` after upload |
| Metrics counters not thread-safe | Guarded by `threading.Lock` |
| `_humanize_bytes` duplicated in Python | Extracted to `app/types/formatting.py` |
| `humanizeBytes` / `formatDate` duplicated in TypeScript | Extracted to `lib/utils.ts` (tested) |
| Custom `FileNotFoundError` shadowed the built-in | Renamed to `FileNotFoundServiceError` |
| Dropzone accepted any file type client-side | `accept` allow-list mirroring backend `ALLOWED_TYPES` (tested for drift) |
| No test harness for feature specs | pytest suite across upload, files, activity, errors, validation, rate limit, pagination |
