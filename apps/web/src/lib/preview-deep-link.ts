/**
 * Deep-linking a single file's preview on `/files`.
 *
 * Picking a file in the ⌘K palette used to `router.push("/files")` and nothing
 * more: on an 18,000-object bucket the chosen file was usually inside a
 * collapsed folder — and if the user was already on `/files`, the click produced
 * no visible change at all, so the app's only search surface looked broken. The
 * dashboard's "Recent Uploads" rows had the same dead-end (inert text, while
 * `/files` teaches "Click a file to preview it").
 *
 * Both now link to `/files?preview=<key>`, which the browser turns into
 * "expand the ancestors, open this file's preview".
 */

/** Query param carrying the key of the file whose preview should open. */
export const PREVIEW_PARAM = "preview";

/** Link target that opens `key`'s preview on the files page. */
export function previewHref(key: string): string {
  return `/files?${PREVIEW_PARAM}=${encodeURIComponent(key)}`;
}

/**
 * Folder paths that must be expanded for `key`'s row to be on screen, outermost
 * first. `"frames/abc/frame-1.png"` -> `["frames/", "frames/abc/"]`.
 *
 * Paths carry the trailing slash used by `buildFileTree`'s `TreeFolder.path`.
 */
export function ancestorPaths(key: string): string[] {
  const parts = key.split("/");
  const paths: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    paths.push(`${parts.slice(0, i + 1).join("/")}/`);
  }
  return paths;
}

/**
 * Read (and consume) the requested preview key from the current URL.
 *
 * Deliberately reads `window.location` rather than `useSearchParams()`: `/files`
 * is prerendered static, and `useSearchParams()` in a client component would
 * force a Suspense boundary around the browser. Consuming the param via
 * `history.replaceState` keeps it from re-firing when the user later closes and
 * reopens the dialog.
 */
export function takePreviewKeyFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const key = url.searchParams.get(PREVIEW_PARAM);
  if (!key) return null;

  url.searchParams.delete(PREVIEW_PARAM);
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  return key;
}
