"""Single-flight, stale-while-revalidate cache for full-bucket object listings.

Extracted from `b2_client` to keep that module under the 300-line ceiling. It is
storage-agnostic on purpose: the caller supplies the fetch, so nothing here
touches boto3.

Why this exists: `/files` and `/files/stats` both need *every* object (newest-N
requires a full listing, since S3 lists lexicographically), and paginating a
16k-object bucket measured 8-20s. One shared scan is therefore mandatory, and a
cache that only ever expires would hand that 8-20s wait to a user again on the
first request after every expiry — which is exactly what a browsing session hits.

So the cache has three states, and only the first can make a caller wait:

1. **cold** (nothing cached) — the caller blocks on a single-flight scan.
2. **fresh** (younger than `settings.list_cache_ttl_seconds`) — served instantly.
3. **stale** — the old snapshot is served *instantly* and a background thread
   refreshes it. Staleness is bounded to bucket changes made outside this app:
   uploads and deletes call `invalidate()`, which drops the entry so the next
   read blocks on a genuinely fresh scan.

Only the empty prefix is cached — caching client-supplied `?prefix=` values
would grow unbounded. Thread-safe: the B2 handlers run in Starlette's
threadpool.
"""

import logging
import time
from collections.abc import Callable
from threading import Lock, Thread

from app.config import settings

logger = logging.getLogger(__name__)

_list_cache: dict[str, tuple[float, list[dict]]] = {}
_list_cache_lock = Lock()  # guards _list_cache, _list_generation, _refreshing
_list_scan_lock = Lock()  # single-flight: one bucket scan at a time
_list_generation = 0  # bumped on invalidation to void in-flight scans
_refreshing: set[str] = set()  # prefixes with a background refresh in flight

Fetch = Callable[[str], list[dict]]


def _ttl() -> float:
    """Read the TTL per call so tests (and env overrides) can change it."""
    return float(settings.list_cache_ttl_seconds)


def invalidate() -> None:
    """Drop cached listings and void any scan already in flight.

    Called after any mutation (upload/delete). Bumping the generation stops a
    scan that started *before* the mutation from writing its stale snapshot
    back into the cache after this clears it.
    """
    global _list_generation
    with _list_cache_lock:
        _list_cache.clear()
        _list_generation += 1


def _reset_state() -> None:
    """Test helper: invalidate and forget any in-flight background refresh."""
    invalidate()
    with _list_cache_lock:
        _refreshing.clear()


def _entry(prefix: str) -> tuple[float, list[dict]] | None:
    """Return the cached (timestamp, listing) for `prefix`, fresh or stale."""
    with _list_cache_lock:
        return _list_cache.get(prefix)


def _is_fresh(entry: tuple[float, list[dict]]) -> bool:
    return time.monotonic() - entry[0] < _ttl()


def cached_listing(prefix: str, fetch: Fetch) -> list[dict]:
    """Return every object under `prefix`, reusing a recent scan when possible.

    The returned list is shared and cached — callers must treat it as read-only
    (never sort/mutate in place). Propagates whatever `fetch` raises, except
    from a background refresh (logged, and the stale snapshot keeps serving).
    """
    # Non-empty prefixes are neither cached nor deduplicated, so routing them
    # through the single-flight lock would serialize unrelated scans for no
    # benefit. Scan them directly (bounded by rate limiting).
    if prefix != "":
        return fetch(prefix)

    entry = _entry(prefix)
    if entry is not None:
        if _is_fresh(entry):
            return entry[1]
        # Stale: hand back the old snapshot now and refresh behind the user's
        # back. Never make someone wait 8-20s for a scan we can do off-request.
        _start_background_refresh(prefix, fetch)
        return entry[1]

    return _scan(prefix, fetch)


def _scan(prefix: str, fetch: Fetch) -> list[dict]:
    """Single-flight blocking scan. The only path that can make a caller wait.

    Serializes (empty-prefix) scans so a cold/expired/invalidated entry can't
    trigger a thundering herd of concurrent full-bucket scans. Waiters re-check
    the cache and reuse the winner's result.
    """
    with _list_scan_lock:
        entry = _entry(prefix)
        if entry is not None and _is_fresh(entry):
            return entry[1]
        with _list_cache_lock:
            generation = _list_generation

        contents = fetch(prefix)  # scan under the single-flight lock

        with _list_cache_lock:
            # Only store if nothing invalidated the cache mid-scan, else we'd
            # cache a pre-mutation snapshot.
            if generation == _list_generation:
                _list_cache[prefix] = (time.monotonic(), contents)
        return contents


def _start_background_refresh(prefix: str, fetch: Fetch) -> None:
    """Refresh `prefix` off the request path, at most one refresh at a time."""
    with _list_cache_lock:
        if prefix in _refreshing:
            return
        _refreshing.add(prefix)
    Thread(
        target=_refresh,
        args=(prefix, fetch),
        name=f"list-cache-refresh:{prefix or 'root'}",
        daemon=True,
    ).start()


def _refresh(prefix: str, fetch: Fetch) -> None:
    try:
        _scan(prefix, fetch)
    except Exception as e:
        # A failed refresh must never surface to the user or kill the thread's
        # process — the previous snapshot stays served until the next attempt.
        logger.warning("Background listing refresh failed (prefix=%r): %s", prefix, e)
    finally:
        with _list_cache_lock:
            _refreshing.discard(prefix)


def prewarm(prefix: str, fetch: Fetch) -> None:
    """Populate the cache off the request path (called once at startup).

    Returns immediately. Without this the first user to open the dashboard or
    the file browser pays for the cold full-bucket scan.
    """
    if _entry(prefix) is not None:
        return
    _start_background_refresh(prefix, fetch)
