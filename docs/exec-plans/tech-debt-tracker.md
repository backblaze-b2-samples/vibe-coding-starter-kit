<!-- last_verified: 2026-08-04 -->
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
| `GET /files` has no pagination — `/files` shows only the newest 100 objects | An older object is unreachable from the UI. The browser now *states* the truncation (`lib/file-list-limit.ts`) instead of claiming "everything in your bucket", but there is still no way to page or search to an older key | Add cursor pagination to `GET /files` (pass through S3's `ContinuationToken` rather than slicing a full scan) plus "Load more"/search in `FileBrowser` | Medium |
| Only the tree layout exists on `/files`; the Settings "Default file view" List and Grid options are demo placeholders | Settings offers Tree/List/Grid but only the tree renders; the option is labelled a demo field and persists to localStorage only | Build real List/Grid renderers plus a view switcher on `/files`, then honour the stored `defaultView` and drop the "Demo field" label | Low |
| `/settings` Profile & preference fields are a labelled demo, not backed by real surfaces | Display name, bio, email-on-upload, quota-warning + threshold, and default view are illustrative placeholders (persist to localStorage, drive nothing) because there is no account system, mailer, quota banner, or activity log. Theme is the only real preference | Build each backing surface (mailer, quota banner, activity log / share links, List/Grid views), then wire the matching field to it — server-side behind a `/preferences` route once auth lands — and drop its "Demo field" label | Low |
| Frontend has no component/render tests; e2e only checks routing | UI states (loading/error/empty) and the real upload→delete journey are unverified | Add jsdom + @testing-library/react render tests; a fixture-driven upload e2e | Medium |
| Allowed file types hardcoded in `service/upload.py` | Reuse friction — each new app edits source to change accepted types | Make `ALLOWED_TYPES` / `MIME_EXTENSION_MAP` env-configurable | Low |
| No auth layer or placeholder | Every consumer designs auth from scratch; unclear where it plugs in | Add example middleware (API-key or JWT) + docs for the seam | Low |
| No `docker-compose.yaml` | Manual venv + dual-process startup slows first run | Add compose with `web` + `api` services and Dockerfiles | Low |
| No dedicated connection-status banner | Offline only surfaced reactively per failed query | Add a global connectivity banner (route + global error boundaries already exist) | Low |
| `e2e/**` and `playwright.config.ts` are excluded from `apps/web/tsconfig.json` | Neither `pnpm typecheck` nor `next build` typechecks the E2E specs, and `pnpm test:e2e` is not in CI — type errors there can sit undetected indefinitely | Add a dedicated `tsconfig.e2e.json` and typecheck it in `pnpm verify:web`, or drop the exclude | Low |
| No tests for the ~545 lines of enforcement logic in `scripts/check-agent-docs.mjs` + `scripts/agent-docs/*.mjs`, against AGENTS.md §4 ("tests for every behavior change") | Seven AGENTS.md §5 rules now name this script as their enforcer, and its own comments record six fixed false-greens (`env-ignore.mjs:6`, `:11`, `check-agent-docs.mjs:63`, `:127`, `:213`, plus folded `run: >` scalars in `workflow.mjs:22`) — the next regression is silent again | Decide the harness: no precedent exists for testing `scripts/` (`doctor.mjs`, `pick-port.mjs` are untested), so this needs a small `node:test` runner over fixture repos, wired into `pnpm verify` as its own gate | Medium |
| `scripts/agent-docs/workflow.mjs:17,128` — `RUN_KEY` matches `run:` at any indentation (including under `with:`), and `readBlockScalar` does not advance the loop index, so block content is re-scanned as top-level lines | Non-executing text can satisfy "CI runs X". Verified with the real `run: pnpm verify:web` step deleted: both a heredoc containing `run: pnpm verify:web` and a `with:` input named `run` pass at exit 0 / 74 checks. Medium only because plain deletion of the job *is* caught | Anchor `run:` to step-level indentation (a `-` list item under `steps:`) and return the consumed line count from `readBlockScalar` so the loop skips past it | Medium |
| `scripts/agent-docs/env-ignore.mjs:36` — `isRepoIgnoreSource` validates the path *shape*, not that the `.gitignore` is tracked, while every message says "repo-tracked" | Verified both directions with an untracked `services/api/.gitignore` containing `.env.*`: false failure (`services/api/.env.example remains trackable — actual ignored`), and, with the root env section deleted, a false pass that is green locally and broken in a fresh clone | Confirm the matching source with `git ls-files --error-unmatch <source>`, or drop "repo-tracked" from the wording | Medium |
| `scripts/agent-docs/workflow.mjs:173` (`checkGateClaims`) — the package.json and CI-claims assertions are presence-only, so a neutered gate still satisfies them | A job disabled with `if: false` still satisfies "declares job X" / "runs X", and `"verify": "pnpm check:agent-docs && pnpm verify:api \|\| true && pnpm verify:web"` still satisfies every composition assertion — both verified at exit 0 / 74 checks. Needs deliberate neutering rather than deletion | Reject `if: false` (and equivalent always-false conditions) on the asserted jobs, and reject short-circuit operators (`\|\|`, `;`, `& `) inside the verify chains | Medium |
| `.github/workflows/ci.yml:4-5` — the header comment holds the only verbatim copy of the verify chain, and `scripts/agent-docs/workflow.mjs` strips comments before parsing by design | `docs/dev-workflows.md` makes `package.json` the single source of truth for the literal chain, so this last hand-maintained copy is permanently invisible to the guard and has already needed a hand edit once | Drop the `=` expansion from the comment and point at `package.json` instead | Low |
| The API contract check covers routes only; request/response *shapes* and the hand-written mirrors of the Pydantic models in `packages/shared/src/types.ts` are still hand-synced | Renaming or retyping a response field passes every gate — `docs/api/openapi.json` updates, the route set is unchanged, and the frontend keeps reading the old field as `undefined`. This is the half of "`api-client.ts` hand-synced to FastAPI" that the contract workflow did not close | Generate the shared TS types from `docs/api/openapi.json` (`openapi-typescript` emits types only, no client), or assert the schema of each client-consumed operation against `packages/shared` | Medium |

## 2026-07-28 — known UI nitpicks

Minor UI issues found during manual QA of the upload → browse → preview flow.
Low-severity polish, left for a follow-up; none blocks the core flow.

- All screens — no `<button>` reports `cursor: pointer` (Tailwind v4 dropped the UA default), and the `/files` filename button uses the body text colour, so the "this is clickable" signal is weak on the controls the main flow depends on. Fix once via `globals.css`
- `/upload` result card — "View in Files" is a bare `/files` navigation with no highlight or scroll-to, so in a deep or busy tree the user hunts for the just-uploaded file again. `previewHref()` now exists, so this is a one-line change
- `/upload` error row — a 113,798,180-byte file is rejected as "exceeds 100MB limit (108.5 MB)"; the cap is actually 100 MiB, so the label and the humanized size use different units than the check
- `/files` preview + upload metadata panel — an EXIF `Software` value can carry trailing NUL padding straight into the rendered DOM (invisible on screen, but unsanitised)
- `/settings` Danger Zone — the "Empty this bucket" card copy makes an unconditional destructive claim with no on-card qualifier (the confirm dialog does note it is a demo)
- `/files` preview dialog — while the presigned URL is pending, the loading label is screen-reader-only and never escalates, so past ~5s a sighted user sees only an unlabelled shimmer (the dashboard, by contrast, escalates its wait copy)
- `/upload` File Details — the success toast can overlap the Dimensions row and hide its value while the panel is open
- 404 route — the breadcrumb title-cases the unknown slug (e.g. "This Route Does Not Exist"), presenting a nonexistent route as a real page name; the rest of the 404 is solid
- `/design` — the "Go to Upload" button inside the Patterns empty-state demo does not navigate; it is presumably a static sample, but it looks live on a linked primary surface

## Resolved

| Description | Resolution |
|---|---|
| `api-client.ts` hand-synced to FastAPI (route drift only) | Added deterministic OpenAPI workflow: `docs/api/openapi.json`, `pnpm contract:export`, `pnpm contract:check`, backend freshness coverage in `test_openapi_contract.py`, and frontend route drift coverage in `api-contract.test.ts`. Full codegen remains a future option only if this lightweight check proves insufficient. **Payload/type drift is not covered** — see the open row on `packages/shared/src/types.ts` |
| Byte-exact OpenAPI comparison against floating Python dependencies | Added `services/api/requirements.lock`, a complete Python 3.12 resolution installed by setup and CI. Intentional dependency refreshes now update the lock and `docs/api/openapi.json` together, so routine verification does not absorb upstream schema churn. |
| Rich metadata (checksums/EXIF/PDF) unavailable for already-stored files | `GET /files-by-key/detail` recomputes `FileMetadataDetail` on demand from the object bytes; `FileMetadataPanel` mounted in the Files preview dialog behind a lazy "Detailed metadata" disclosure |
| Blocking boto3 in `async def` handlers froze the single event loop | B2 handlers are sync `def` (Starlette threadpool); upload offloads via `run_in_threadpool` |
| Full-bucket scan on every list/stats/activity request, uncached | Short-TTL cache in `repo/b2_client._list_all_objects`, invalidated on upload/delete |
| No CI — quality gates ran only when a human remembered | `.github/workflows/ci.yml` runs all three `pnpm verify` gates — `check:agent-docs`, `verify:api`, `verify:web` — as parallel jobs on PR and push to `main` |
| README called AGENTS.md a "~100 line" entry point and concurrent `pnpm verify` shared Next.js's build lock | Replaced the stale size claims with bounded wording; the workflow supports one verification per worktree, documents the narrow `.next/lock` recovery, pre-commit use, timing, and separate E2E prerequisites |
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
