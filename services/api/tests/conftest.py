import socket

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture(autouse=True)
def deny_external_network(monkeypatch):
    """Normal API tests are hermetic; live service checks live outside tests/.

    Only *external* connections are rejected. Loopback stays open so in-process
    localhost servers and platform event-loop self-pipes (e.g. asyncio's
    socketpair emulation on Windows) keep working — the goal is to block real
    B2/external traffic, not all sockets."""

    real_connect = socket.socket.connect
    loopback_hosts = {"127.0.0.1", "::1", "localhost", ""}

    def blocked_connect(self, address, *args, **kwargs):
        host = address[0] if isinstance(address, (tuple, list)) else address
        if host in loopback_hosts:
            return real_connect(self, address, *args, **kwargs)
        raise AssertionError(
            "External network access is forbidden in normal API tests; mock the repo boundary"
        )

    monkeypatch.setattr(socket.socket, "connect", blocked_connect)


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture(autouse=True)
def clear_list_cache():
    """Clear the repo's bucket-listing cache before each test so cached
    listings never leak across tests (keeps the pagination tests hermetic).

    Uses `_reset_state()` rather than `invalidate()` so a background
    stale-while-revalidate refresh from an earlier test can't leave the prefix
    marked as "refreshing" and suppress the next test's refresh."""
    from app.repo import list_cache

    list_cache._reset_state()
    yield


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the per-IP rate-limit counters before each test — otherwise the
    whole suite shares one client IP and accumulates hits across tests."""
    from app.runtime import ratelimit

    ratelimit._reset_state()
    yield


@pytest.fixture(autouse=True)
def reset_shared_module_state():
    """Reset the remaining shared module state (B2 connectivity cache and the
    in-process metrics counters) so absolute-value assertions can't become
    order-dependent across the suite."""
    from app.repo import b2_client
    from app.runtime import metrics

    cached_get_s3_client = b2_client.get_s3_client
    cached_get_s3_client.cache_clear()
    b2_client._health_cache = None
    with metrics._lock:
        metrics._request_count.clear()
        metrics._request_duration_sum.clear()
        metrics._upload_count = 0
        metrics._upload_errors = 0
    yield
    cached_get_s3_client.cache_clear()


@pytest.fixture(autouse=True)
def isolate_download_counter(tmp_path, monkeypatch):
    """Redirect the persisted download counter to a temp file per test and
    reset the in-memory counter to 0. Keeps tests hermetic and prevents
    stray writes to services/api/data/."""
    from app.config import settings
    from app.repo import counter

    counter_path = tmp_path / "download_count.json"
    monkeypatch.setattr(settings, "download_count_file", str(counter_path))
    monkeypatch.setattr(counter, "_count", 0)
    yield
