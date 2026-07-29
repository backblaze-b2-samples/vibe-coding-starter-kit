/**
 * How many objects `/files` asks for, and the copy that admits it.
 *
 * `GET /files` returns the newest `limit` objects (default 100) with no
 * pagination. A bucket with thousands of objects therefore shows a small recent
 * slice — the browser used to present that slice as "everything in your
 * bucket", so an older file was unreachable AND unacknowledged. Pagination is
 * still open tech debt; until then the UI states the truncation.
 */
export const FILE_LIST_LIMIT = 100;

function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

/**
 * Copy for the truncation notice, or `null` when nothing is being hidden.
 *
 * @param shown  rows currently rendered (the API response length)
 * @param total  bucket-wide object count from `/files/stats`; `undefined` while
 *               that query is still loading or if it failed
 * @param limit  the limit the list was requested with
 */
export function fileListTruncationNotice(
  shown: number,
  total: number | undefined,
  limit: number = FILE_LIST_LIMIT,
): string | null {
  // Fewer rows than the limit means the API had nothing more to give.
  if (shown < limit) return null;

  if (typeof total === "number" && Number.isFinite(total) && total > shown) {
    return `Showing the ${formatCount(shown)} most recent of ${formatCount(
      total,
    )} objects in this bucket. Older objects aren't listed yet.`;
  }

  // Hit the limit but the bucket total is unknown (stats still loading, or it
  // disagrees with the list). Still admit the cap rather than implying "all".
  return `Showing the ${formatCount(
    shown,
  )} most recent objects in this bucket. Older objects aren't listed yet.`;
}
