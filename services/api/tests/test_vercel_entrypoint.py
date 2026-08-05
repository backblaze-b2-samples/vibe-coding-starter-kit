"""Regression coverage for the Vercel FastAPI discovery entrypoint.

On Vercel the API is served under the ``/api`` path prefix (single-origin
``services`` deployment). The entrypoint is a thin ASGI wrapper that strips that
prefix and delegates to ``main.app`` — so it is no longer identical to
``main.app``, but it must route ``/api``-prefixed requests to the same handlers
and leave unprefixed (local) requests untouched.
"""

import inspect

import index
from index import _strip_prefix
from index import app as vercel_app


def test_vercel_entrypoint_is_an_asgi_callable():
    # ASGI3 application: an async callable taking (scope, receive, send).
    assert inspect.iscoroutinefunction(vercel_app)
    assert list(inspect.signature(vercel_app).parameters) == ["scope", "receive", "send"]


def test_strip_prefix_removes_the_api_segment():
    assert _strip_prefix({"type": "http", "path": "/api/health"})["path"] == "/health"
    assert _strip_prefix({"type": "http", "path": "/api/files/stats"})["path"] == "/files/stats"


def test_strip_prefix_maps_bare_prefix_to_root():
    assert _strip_prefix({"type": "http", "path": "/api"})["path"] == "/"


def test_strip_prefix_leaves_unprefixed_paths_unchanged():
    scope = {"type": "http", "path": "/health"}
    assert _strip_prefix(scope) is scope


def test_strip_prefix_also_rewrites_raw_path():
    stripped = _strip_prefix(
        {"type": "http", "path": "/api/files", "raw_path": b"/api/files"}
    )
    assert stripped["raw_path"] == b"/files"


def test_strip_prefix_sets_root_path_so_generated_urls_keep_the_prefix():
    # root_path is what makes FastAPI prepend /api to redirects and the docs
    # openapi_url, so they resolve back through the /api rewrite.
    assert _strip_prefix({"type": "http", "path": "/api/health"})["root_path"] == "/api"


async def _capture_delegated_scope(monkeypatch, scope: dict) -> dict:
    """Invoke the ASGI wrapper with a stub downstream and return the scope it saw."""
    captured: dict = {}

    async def fake_app(received_scope, receive, send):
        captured["scope"] = received_scope

    monkeypatch.setattr(index, "_app", fake_app)

    async def receive():
        return {"type": "http.request"}

    async def send(_message):
        return None

    await index.app(scope, receive, send)
    return captured["scope"]


async def test_app_delegates_http_with_stripped_path_and_root_path(monkeypatch):
    seen = await _capture_delegated_scope(
        monkeypatch, {"type": "http", "path": "/api/files/stats"}
    )
    assert seen["path"] == "/files/stats"
    assert seen["root_path"] == "/api"


async def test_app_strips_the_websocket_path(monkeypatch):
    seen = await _capture_delegated_scope(
        monkeypatch, {"type": "websocket", "path": "/api/ws"}
    )
    assert seen["path"] == "/ws"


async def test_app_passes_lifespan_scope_through_untouched(monkeypatch):
    scope = {"type": "lifespan"}
    seen = await _capture_delegated_scope(monkeypatch, scope)
    # Lifespan must reach main.app verbatim (startup validation + cache warm),
    # never path-rewritten.
    assert seen is scope
    assert "root_path" not in seen
