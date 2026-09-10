/**
 * Start a file download from a presigned URL.
 *
 * This used to be `window.open(url, "_blank")` after awaiting the presign call,
 * which can silently do nothing at all: once the click's user activation has
 * expired (measured with a 4s presign round trip) the popup is dropped, and
 * there is no tab, no download, and no error to report. A same-document anchor
 * click is a download, not a popup, so it survives an expired activation. The
 * URL is signed with `Content-Disposition: attachment`, so the browser saves the
 * file instead of navigating away from the app.
 *
 * @param doc injectable for tests; defaults to the live document
 * @returns false when there is no document to click in (SSR / no DOM), so the
 *          caller reports a failure instead of claiming a download started
 */
export function startBrowserDownload(
  url: string,
  filename?: string,
  doc: Document | undefined = typeof document === "undefined"
    ? undefined
    : document,
): boolean {
  if (!url || !doc?.body) return false;

  const anchor = doc.createElement("a");
  anchor.href = url;
  // Ignored cross-origin (B2 sets the disposition), honoured same-origin.
  if (filename) anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
