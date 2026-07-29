<!-- last_verified: 2026-07-28 -->
# Feature: File Browser

## Purpose
List, preview, download, and delete files stored in Backblaze B2.

## Used By
- UI: `/files` page, file browser component
- API: `GET /files`, `GET /files-by-key/metadata?key=...`, `GET /files-by-key/detail?key=...`, `GET /files-by-key/download?key=...`, `GET /files-by-key/preview?key=...`, `DELETE /files-by-key?key=...`
- Legacy API: `GET /files/{key}`, `GET /files/{key}/download`, `GET /files/{key}/preview`, `DELETE /files/{key}`

## Core Functions
- `apps/web/src/components/files/file-browser.tsx` — tree view container with loading, empty, error, refresh, preview, download, and delete flows
- `apps/web/src/components/files/file-tree-row.tsx` — recursive folder/file rows. The file row is a button that opens the preview; the actions menu is a sibling button that is always visible (never hover-gated)
- `apps/web/src/components/files/file-preview.tsx` — dialog modal for file preview, including its Download / Delete action row
- `apps/web/src/components/files/file-preview-media.tsx` — `PreviewMedia` owns the media load state so the skeleton persists until the `load` event (its own module to keep the dialog under the 300-line ceiling)
- `apps/web/src/components/files/file-metadata-panel.tsx` — structured metadata display
- `apps/web/src/lib/file-tree.ts` — `buildFileTree()` converts flat S3 keys to a folder/file hierarchy; `initialExpandedPaths()` decides how deep to auto-expand so file rows are actually on screen
- `apps/web/src/lib/preview-deep-link.ts` — `previewHref()` / `ancestorPaths()` / `takePreviewKeyFromUrl()` for the `?preview=<key>` hand-off used by the ⌘K palette and the dashboard
- `apps/web/src/lib/browser-download.ts` — `startBrowserDownload()`: anchor-click navigation that survives an expired user activation
- `apps/web/src/lib/loading-progress.ts` + `apps/web/src/components/common/loading-notice.tsx` — visible, escalating copy for a wait that can take seconds
- `apps/web/src/lib/file-list-limit.ts` — `FILE_LIST_LIMIT` + `fileListTruncationNotice()`: the copy that admits the list is capped
- `apps/web/src/lib/queries.ts` — TanStack hooks; `useDownloadUrl()` is a mutation so the presign round trip has a real pending state; `dropDeletedFileFromCache()` removes a deleted row from every cached list optimistically
- `apps/web/src/lib/api-client.ts` — `getFiles()`, `getFile()`, `getFileDetail()`, `getDownloadUrl()`, `getPreviewUrl()`, `deleteFile()`; sends object keys as query parameters so slashes and reserved route names cannot be decoded into path segments
- `services/api/app/runtime/files.py` — HTTP handlers for list, get, detail, download, delete
- `services/api/app/service/files.py` — business logic, key validation, `get_file_detail()` on-demand recompute
- `services/api/app/repo/b2_client.py` — `list_files()`, `get_file_metadata()`, `get_presigned_url(..., disposition=)`, `delete_file()`
- `services/api/app/repo/list_cache.py` — single-flight, stale-while-revalidate cache for full-bucket listings (storage-agnostic; the caller supplies the fetch). `prewarm()` warms it at startup
- `services/api/app/repo/b2_object.py` — `get_object_bytes()` (object download for detail recompute)

## Canonical Files
- File route handlers: `services/api/app/runtime/files.py`
- File tree builder: `apps/web/src/lib/file-tree.ts`
- B2 data access pattern: `services/api/app/repo/b2_client.py`

## Inputs
- prefix: string (optional filter for file listing)
- limit: int (max files to return, 1-1000, default 100)
- key: string (file key for get/download/delete — sent as a query parameter by the web client; no path traversal)

## Outputs
- `GET /files` → `FileMetadata[]` (sorted most recent first)
- `GET /files-by-key/metadata?key=...` → `FileMetadata` (cheap `head_object`; core fields only)
- `GET /files-by-key/detail?key=...` → `FileMetadataDetail` (checksums + image/PDF fields). Downloads the object and re-runs extraction on demand, so it's billed at the tighter write rate-limit tier and returns 413 for objects above `max_file_size`.
- `GET /files-by-key/download?key=...` → `{ url: string }` (presigned URL, `Content-Disposition: attachment`, 10-min expiry). Increments the `total_downloads` counter exposed on `/files/stats`. The counter is persisted via `repo/counter.py` to `.data/download_count.json` at the repo root (override via `DOWNLOAD_COUNT_FILE`; relative paths resolve from the repo root). It deliberately lives outside `services/api/`, the directory `uvicorn --reload` watches — a counter file inside it meant every download wrote into the dev reloader's watch tree, which surfaced as "N changes detected" log noise on each download and was one `--reload-include` away from bouncing the API mid-request. It survives a local process restart; see [RELIABILITY.md](../RELIABILITY.md#stateful-counters--durability-caveats) for its limits on ephemeral filesystems and across replicas.
- `GET /files-by-key/preview?key=...` → `{ url: string }` (presigned URL with `Content-Disposition: inline`, 10-min expiry). Does **not** increment the download counter — used by the preview modal for images / PDFs. The disposition is the whole point: an `attachment` response makes the browser download the file, so an `<iframe>` PDF preview can never paint (`<img>` ignores the header, which is why images masked this). `repo.get_presigned_url()` takes `disposition="attachment" | "inline"` and rejects anything else.
- `DELETE /files-by-key?key=...` → `{ deleted: true, key: string }`
- Legacy `/files/{key}` routes remain available for compatibility. The web client uses them only as a rolling-deploy fallback when `/files-by-key` is unavailable and the key is safe to place in a legacy path.
- Side effects: DELETE removes file from B2; `/download` increments the in-memory download counter

## Flow
- Page loads → fetches the newest `FILE_LIST_LIMIT` (100) objects from `GET /files` (sorted most recent first). That needs a full bucket listing, so the wait is stated on screen in words (not `sr-only`) and escalates past 4s and 12s — see `lib/loading-progress.ts`. The API side keeps it rare: one shared listing cache, served stale-while-revalidate, warmed at startup
- When the response hits that limit, a notice states how much of the bucket is not listed ("Showing the 100 most recent of N objects"), read from `/files/stats`. The card is titled "Recent Files", not "All Files" — there is no pagination yet (see the tech-debt tracker)
- Files organized into tree view — folders expand/collapse, files shown with type-specific icons
- Folders auto-expand on load, level by level, until the **majority** of the listed files are visible (`initialExpandedPaths()`). Expanding only the top level could leave the page showing four folder rows and zero files while instructing the user to click one, because the newest objects lived two levels deep. Stopping at the *first* visible file was then still wrong: a single stray top-level object satisfied it while the other 99 stayed collapsed and the page claimed "Showing the 100 most recent"
- Deep link: arriving with `?preview=<key>` (`takePreviewKeyFromUrl()`) expands that key's ancestor folders (`ancestorPaths()`) and opens its preview. The ⌘K palette and the dashboard's recent-uploads rows link here so that choosing a specific file lands on that file; previously the palette pushed a bare `/files`, which did nothing visible when the user was already on the page. The param is read via `window.location` rather than `useSearchParams()` so `/files` stays statically prerenderable, and is consumed with `history.replaceState` so it doesn't re-fire
- Clicking anywhere on a file row (except the actions button) opens its preview — the row is a real `<button>` with an `aria-label` of `Preview <filename>`
- The actions menu trigger (`Open actions for <filename>`) is rendered at full opacity at rest on every viewport, as an outlined button with full-contrast foreground so it reads as a control rather than a faint `···` glyph ~1100px from the filename; hover/focus only deepens it. It must never be hover-gated: that hid preview / download / delete from keyboard, touch, and first-time desktop users
- Preview: opens dialog, fetches a preview-only presigned URL via `/files-by-key/preview?key=...` (does not count as a download) and renders image/PDF inline. The dialog carries the file's full action set — **Download** and **Delete** alongside the "Detailed metadata" disclosure — because "Click a file to preview it" is the path the page advertises and it used to dead-end with only a close button. Delete closes the preview and hands off to the same confirmation dialog the row menu uses. Expanding "Detailed metadata" lazily fetches `/files-by-key/detail?key=...` and renders checksums + image/PDF fields in `FileMetadataPanel`.
- Download: `useDownloadUrl()` fetches a presigned URL via `/files-by-key/download?key=...` (attachment disposition, 10-min expiry), bumps the download counter, and invalidates the stats query. While the presign is in flight the row's Download item reads "Preparing download…" and is disabled, and a loading toast is up; success/failure replaces it. The navigation is an anchor click (`startBrowserDownload()`), not `window.open`: with a slow presign the click's user activation can expire, and the popup was then dropped with **no** tab, no download and no UI trace at all
- Delete: the confirmation's action button calls `event.preventDefault()` so Radix does not auto-close the dialog — it stays open showing "Deleting..." until the mutation settles. Without that, the dialog vanished ~239ms after the click while the DELETE only returned at ~554ms, so the sole pending state was never seen and the row sat there looking untouched. It then calls `DELETE /files-by-key?key=...`; on success the row is removed from the TanStack cache immediately (`dropDeletedFileFromCache`) and the deleted key's cached preview/detail entries are evicted, then every B2 query is invalidated to reconcile. Without the cache edit the toast fired ~5-6s before the row disappeared (the refetch re-lists the whole bucket) and the stale row's Preview 404'd
- All key-based API calls send the key in the query string and validate it against path-traversal patterns in the API service layer
- During frontend/API version skew, the web client falls back to legacy path routes only for keys that cannot collide with reserved file routes such as stats, download, or preview.

## Edge Cases
- File not found (deleted externally) → API returns 404
- Invalid file key (traversal attempt, empty key) → API returns 400
- File key contains `/`, spaces, `#`, `?`, `%`, reserved route names, or suffixes like `/download` and `/preview` → web client sends the key as a query parameter before calling get/download/preview/delete routes
- B2 unreachable → persistent error state with retry
- Empty bucket → upload prompt with direct Upload action
- Delete failure → API returns 500, toast error
- Download presign slow or failed → the loading toast resolves into a success or an error toast; a browser that refuses the anchor click is reported, never silently swallowed
- Cold bucket listing (nothing cached) → the one request that pays for the scan blocks; every later one is served from cache, including a stale snapshot while it refreshes in the background

## UX States
- Empty: centered message with upload prompt and Upload action
- Loading: an on-screen "Loading files…" notice above the skeleton rows, escalating to "Still loading files…" plus an explanation at 4s and a "can take 20 seconds or more the first time, then it's cached" note at 12s. The words must never be `sr-only`: measured cold loads ran 2.8s-21s, and pulsing bars alone gave a sighted user no way to tell a slow listing from a hung one
- Error: inline error state with Retry
- Loaded: tree view with expand/collapse folders and focus/hover action menus
- Preview: responsive dialog with wrapped file names, fallback copy for preview URL failures, and metadata that tolerates long keys; a "Detailed metadata" disclosure lazily loads checksums/EXIF/PDF fields (skeleton while loading, inline error if the recompute fails). A `metadata_warning` from the API renders as an inline note so a skipped extractor is never a silently missing section
- Preview loading: the skeleton covers the presigned-URL fetch **and** the media download, dropping only on the media's `load` event. On `error` the pane shows an error state with an "Open in a new tab" fallback. Dropping the skeleton at the presign milestone left a blank white pane that read as "no preview available"

## Verification
- Test files: `services/api/tests/test_file_key_routes.py`, `services/api/tests/test_presign_disposition.py`, `services/api/tests/test_list_cache.py`, `apps/web/src/lib/api-client.test.ts`, `apps/web/src/lib/queries.test.ts`, `apps/web/src/lib/file-list-limit.test.ts`, `apps/web/src/lib/file-tree.test.ts`, `apps/web/src/lib/preview-deep-link.test.ts`, `apps/web/src/lib/browser-download.test.ts`, `apps/web/src/lib/loading-progress.test.ts`
- Required cases: list files, empty list, file not found, presigned URL generation, preview presigns `inline` while download presigns `attachment`, unknown disposition rejected, delete success, delete failure, optimistic cache removal on delete, truncation notice on/off, listing cache (fresh reuse / stale-served-while-refreshing / invalidation forces a fresh scan / prewarm), auto-expansion reaching the first file rows, anchor-click download reporting success and failure, loading copy escalating at its thresholds
- Focused API verify command: `pnpm test:api`
- Focused client route-construction command: `pnpm test:web`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Dev Workflows](../dev-workflows.md#commands) are available
- Pass criteria: focused tests and `pnpm verify` green; explain any skipped `pnpm verify:full` prerequisites

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
