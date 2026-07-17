<!-- last_verified: 2026-04-22 -->
# Security

Security principles and implementation for the vibe-coding-starter-kit.

## Trust Boundaries

- **Frontend -> API**: CORS-restricted to configured origins, scoped to `GET/POST/DELETE/OPTIONS`. `allow_credentials` is `False` (no cookie/session auth today); enable it only alongside real auth and a tightened origin allowlist.
- **API -> B2**: Authenticated via `B2_KEY_ID` + `B2_APPLICATION_KEY`, signature v4
- **Client -> B2**: Presigned URLs for download (10-min expiry, `Content-Disposition: attachment`)

## Authentication & Multi-Tenancy

- **No auth by design.** The file API (`/files`, `/files-by-key`, `/upload`) is unauthenticated and bucket-wide — any client can list, download, and delete every object. Acceptable for a single-tenant demo; the rate limiter guards the open endpoints.
- **Adding auth to a clone does not close this automatically.** A login screen alone leaves an open, cross-user file API. You must both (1) require auth on every file route and (2) scope listings and reads to the caller's own prefixes — skipping either lets one signed-in user read and delete another's files. See the co-located notes in `runtime/files.py` and `service/files.py`.

## Upload Validation

- Filename sanitization: path traversal, null bytes, unsafe chars stripped
- MIME/extension consistency check against allowlist
- Chunked streaming with size enforcement (100MB default)
- Content-type allowlist (images, PDFs, text, archives, audio/video). **SVG is excluded** — it can embed `<script>` that executes when served from a public bucket URL (stored XSS). Re-add only with server-side sanitization.
- **Magic-byte signature check**: for binary types, the leading bytes must match the declared content type, so a script payload can't masquerade as `image/png`. Text-like types (plain/CSV/JSON) have no signature and skip this check.
- Empty file rejection

## Rate Limiting

- Per-IP fixed-window limiter (`app/runtime/ratelimit.py`), configurable via `RATE_LIMIT_PER_MINUTE` (reads) and `RATE_LIMIT_WRITE_PER_MINUTE` (uploads/deletes/downloads). Guards against DoS and Backblaze transaction/egress cost amplification on the unauthenticated endpoints.
- In-process, per replica. Horizontal scaling needs a shared store (e.g. Redis) — see [RELIABILITY.md](RELIABILITY.md).

## File Key Validation

- Empty keys rejected
- Path traversal patterns rejected (`../`, `%2e%2e`, backslashes, null bytes)
- Optional prefix confinement: set `ALLOWED_KEY_PREFIX` (e.g. `uploads/`) to restrict key-addressed reads/deletes when the bucket is shared with other workloads. Empty by default — the by-key routes otherwise accept arbitrary folder and reserved-word keys by design.

## Download Safety

- Presigned URLs force `Content-Disposition: attachment`
- Prevents inline rendering of user-uploaded content (XSS mitigation)

## Response Hardening

- Baseline headers on every API response: `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`
- Interactive API docs (`/docs`, `/redoc`, `/openapi.json`) are on by default but can be disabled with `ENABLE_DOCS=false` to hide the API surface in production

## Secrets Management

- All secrets loaded via environment variables (pydantic-settings)
- Never committed to source control
- `.env.example` documents required variables without values

## Agent Security Rules

- Never commit `.env`, credentials, or API keys
- Never weaken validation without explicit instruction
- Never bypass CORS, auth, or input sanitization
- Always validate at system boundaries
