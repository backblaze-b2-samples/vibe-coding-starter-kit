<!-- last_verified: 2026-07-15 -->
# Tech Debt Tracker

Known tech debt items. Agents update this when they discover or create tech debt.

## Open

| Description | Impact | Proposed Resolution | Priority |
|---|---|---|---|
| Download counter & `/metrics` not durable across restart/replicas | Counter resets on redeploy (ephemeral FS); both fragment across replicas | Back the counter with a shared store (Redis/DB); label/aggregate metrics per instance. Relocated to `repo/counter.py` and documented in RELIABILITY.md | Medium |
| Upload buffers the whole file in memory | ~3× file size RAM per upload; large files strain the server (event loop no longer blocked, but memory unbounded) | Stream to a temp file, or S3 multipart above a size threshold | Medium |
| `get_upload_activity` re-materializes `FileMetadata` for every object just to bucket dates | Wasted O(n) CPU per `/files/stats/activity` (scan is cached; materialization is not) | Aggregate from raw listing dicts like `get_upload_stats` does | Low |
| Frontend has no component/render tests; e2e only checks routing | UI states (loading/error/empty) and the real upload→delete journey are unverified | Add jsdom + @testing-library/react render tests; a fixture-driven upload e2e | Medium |
| Allowed file types hardcoded in `service/upload.py` | Reuse friction — each new app edits source to change accepted types | Make `ALLOWED_TYPES` / `MIME_EXTENSION_MAP` env-configurable | Low |
| No auth layer or placeholder | Every consumer designs auth from scratch; unclear where it plugs in | Add example middleware (API-key or JWT) + docs for the seam | Low |
| No `docker-compose.yaml` | Manual venv + dual-process startup slows first run | Add compose with `web` + `api` services and Dockerfiles | Low |
| `api-client.ts` hand-synced to FastAPI | Endpoint drift between client and server | Note an OpenAPI codegen strategy or link the spec | Low |
| No dedicated connection-status banner | Offline only surfaced reactively per failed query | Add a global connectivity banner (route + global error boundaries already exist) | Low |

## Resolved

| Description | Resolution |
|---|---|
| Blocking boto3 in `async def` handlers froze the single event loop | B2 handlers are sync `def` (Starlette threadpool); upload offloads via `run_in_threadpool` |
| Full-bucket scan on every list/stats/activity request, uncached | Short-TTL cache in `repo/b2_client._list_all_objects`, invalidated on upload/delete |
| No CI — quality gates ran only when a human remembered | `.github/workflows/ci.yml` runs web + API gates on PR and push to `main` |
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
