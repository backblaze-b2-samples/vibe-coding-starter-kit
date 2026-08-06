# Presigned Direct-to-B2 Upload

Closes [#52](https://github.com/backblaze-b2-samples/vibe-coding-starter-kit/issues/52).

## Goal

Remove the ~4.5 MB upload ceiling that Vercel Functions impose, by having the
browser upload file bytes **directly to B2** instead of streaming them through
the API Function. This also makes the kit a stronger B2 showcase (direct-to-storage
upload) and unifies behaviour across local, Railway, and Vercel.

## Decision: one path for everyone (no config flag, no quarantine by default)

We replace the multipart proxy upload with a single direct-to-B2 flow used on
**every** platform. We considered keeping the proxy as a default and gating the
direct flow behind a config flag, but that doubles the code/UX/test surface for
no benefit — the direct flow loses no validation (below), so there is no reason
to keep two.

### Why this does not weaken validation

The old proxy validated the bytes in-flight: size, type allow-list,
extension/type consistency, filename sanitisation, and magic-byte sniffing. All
of these are preserved, verified live against B2 (see the probes in the issue
thread):

| Check | How it is preserved on the direct path |
|-------|----------------------------------------|
| **Size** | The API signs `Content-Length` into the presigned PUT. B2 rejects any body of a different size with `403 SignatureDoesNotMatch` (verified). The API refuses to presign a declared size above `max_file_size`. So size is *prevented*, not merely detected. |
| **Declared content-type** | Signed into the PUT (`content-type` is in `X-Amz-SignedHeaders`); the browser must send exactly that value. |
| **Type allow-list + extension/type match** | Enforced at presign time from the declared filename + type, reusing the existing `ALLOWED_TYPES` / `validate_extension_matches_type`. |
| **Filename → object key** | The API mints the key (`uploads/<sanitised>`); the client never chooses it. |
| **Magic-byte sniff** | After the PUT, `verify` issues a `Range: bytes=0-511` GET (verified `206`) and re-runs `matches_content_signature` on the header bytes — cheap even for a 100 MB object. A mismatch deletes the object and returns 415. |

Backblaze B2 does **not** implement browser `POST` policy uploads
(`generate_presigned_post` → `501 NotImplemented`, verified), so we use
presigned **PUT**. Presigned PUT cannot carry a `content-length-range`, but the
signed exact `Content-Length` above gives equivalent size enforcement.

### The one residual difference

`verify` is **best-effort**: the browser is trusted to call it. A client that
PUTs and never calls verify leaves the object in place, and the periodic
bucket scan will eventually list it — so the magic-byte sniff is not an
unconditional gate the way the old in-process proxy was. What *is*
unconditional, and carries the real weight, is the presign allow-list (no
HTML/SVG) plus the **signed content-type**: the object is always stored and
served as an allow-listed, non-executable type, so a spoofed payload cannot be
served as HTML/script. The sniff at verify is defense-in-depth on top of that.

A quarantine→promote variant (`copy_object` verified working) makes byte-level
validation unconditional — upload to a `pending/<token>/` prefix, promote to
`uploads/` only after verify, exclude `pending/` from listings, and add a B2
lifecycle rule to reap abandoned pending objects. It is **off by default** to
keep the flow simple and is the recommended hardening for anyone exposing a
public bucket URL (`B2_PUBLIC_URL`).

### Metadata at upload

`verify` returns core metadata only (`metadata: null`); it deliberately does not
download the whole object to recompute checksums/EXIF. Rich metadata stays
available on demand via the existing `GET /files-by-key/detail`. This matches
the documented "extraction is not persisted, recomputed on demand" model.

## Scope

1. **Backend**: replace `POST /upload` with `POST /upload/presign` (validate +
   sign) and `POST /upload/verify` (HEAD + Range sniff + cache invalidation).
   New repo helpers `generate_presigned_upload`, `get_object_head_bytes`,
   `invalidate_listing`. Reuse all existing validation helpers.
2. **Contract**: re-export `docs/api/openapi.json`; update `API_CLIENT_ROUTES`.
3. **Frontend**: `uploadFile()` keeps its `(file, onProgress) => FileUploadResponse`
   signature but internally does presign → direct PUT (XHR, progress) → verify.
   The upload queue, progress UI, and status labels are otherwise unchanged.
4. **Tests**: rewrite the backend upload tests around presign/verify; helper unit
   tests unchanged; contract test picks up the new routes.
5. **B2 CORS**: documented for the deploy origin, with a standalone helper script
   `services/api/scripts/setup_b2_cors.py`.
6. **Docs**: file-upload, ARCHITECTURE, README, infra/vercel, RELIABILITY,
   metadata-extraction.

## Validation

- `pnpm verify` (agent-docs, API lint/tests/structure, web lint/tests/typecheck/build).
- Live B2 capability probes recorded in the issue thread (POST 501, PUT 200,
  signed Content-Length 403-on-mismatch, Range 206, copy_object OK).
- No object left in the bucket by the probes (create + delete, `test-` prefix).
