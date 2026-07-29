"""Repo-level tests for the stale-while-revalidate listing cache.

The cache is the only thing standing between a user and an 8-20s full-bucket
scan, so its three states are pinned here: cold blocks, fresh is instant, and
stale is served instantly while a background thread refreshes it. A regression
that made every expiry block again would hand that 8-20s wait back to the user
without failing any other test.
"""

import time

import pytest

from app.config import settings
from app.repo import list_cache


class _CountingFetch:
    """Fetch stub that returns a distinguishable listing per call."""

    def __init__(self, delay: float = 0.0):
        self.calls = 0
        self.delay = delay

    def __call__(self, prefix: str) -> list[dict]:
        self.calls += 1
        if self.delay:
            time.sleep(self.delay)
        return [{"Key": f"{prefix}call-{self.calls}"}]


@pytest.fixture(autouse=True)
def clean_cache():
    list_cache._reset_state()
    yield
    list_cache._reset_state()


def _wait_for(predicate, timeout: float = 5.0) -> bool:
    """Poll until `predicate()` is true (background refresh is a real thread)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.01)
    return False


def test_fresh_entry_is_reused(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()

    first = list_cache.cached_listing("", fetch)
    second = list_cache.cached_listing("", fetch)

    assert first == second == [{"Key": "call-1"}]
    assert fetch.calls == 1


def test_stale_entry_is_served_immediately_and_refreshed(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()
    assert list_cache.cached_listing("", fetch) == [{"Key": "call-1"}]

    # Everything cached is now stale.
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 0.0)
    started = time.monotonic()
    fetch.delay = 0.2  # a "slow scan" the caller must NOT wait for
    stale = list_cache.cached_listing("", fetch)
    elapsed = time.monotonic() - started

    # Served the old snapshot without waiting on the refresh.
    assert stale == [{"Key": "call-1"}]
    assert elapsed < 0.2

    # ...and the refresh really ran to completion and replaced the snapshot.
    # `_refreshing` empties only after the store, so it is the completion signal
    # (`fetch.calls` increments before the scan finishes).
    assert _wait_for(lambda: not list_cache._refreshing)
    assert fetch.calls == 2
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    assert list_cache.cached_listing("", fetch) == [{"Key": "call-2"}]
    assert fetch.calls == 2


def test_only_one_background_refresh_runs_at_a_time(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()
    list_cache.cached_listing("", fetch)

    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 0.0)
    fetch.delay = 0.3
    for _ in range(5):
        list_cache.cached_listing("", fetch)

    assert _wait_for(lambda: not list_cache._refreshing)
    # Five stale reads, one refresh — not five concurrent bucket scans.
    assert fetch.calls == 2


def test_invalidation_forces_a_blocking_fresh_scan(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()
    list_cache.cached_listing("", fetch)

    list_cache.invalidate()

    # A mutation must never be followed by a stale read.
    assert list_cache.cached_listing("", fetch) == [{"Key": "call-2"}]
    assert fetch.calls == 2


def test_nonempty_prefix_is_never_cached(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()

    list_cache.cached_listing("folder/", fetch)
    list_cache.cached_listing("folder/", fetch)

    assert fetch.calls == 2
    assert list_cache._entry("folder/") is None


def test_prewarm_populates_without_a_caller_waiting(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch(delay=0.1)

    list_cache.prewarm("", fetch)

    assert _wait_for(lambda: not list_cache._refreshing and fetch.calls == 1)
    assert list_cache._entry("") is not None
    # The warm entry is what the first request reads — no second scan.
    assert list_cache.cached_listing("", fetch) == [{"Key": "call-1"}]
    assert fetch.calls == 1


def test_prewarm_is_a_noop_when_already_cached(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()
    list_cache.cached_listing("", fetch)

    list_cache.prewarm("", fetch)

    assert not _wait_for(lambda: fetch.calls > 1, timeout=0.3)


def test_background_refresh_failure_keeps_serving_the_old_snapshot(monkeypatch):
    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 300.0)
    fetch = _CountingFetch()
    list_cache.cached_listing("", fetch)

    def boom(_prefix: str) -> list[dict]:
        raise RuntimeError("B2 list failed")

    monkeypatch.setattr(settings, "list_cache_ttl_seconds", 0.0)
    assert list_cache.cached_listing("", boom) == [{"Key": "call-1"}]
    assert _wait_for(lambda: not list_cache._refreshing)
    # Still serving the snapshot; the failure never reached the caller.
    assert list_cache.cached_listing("", boom) == [{"Key": "call-1"}]
