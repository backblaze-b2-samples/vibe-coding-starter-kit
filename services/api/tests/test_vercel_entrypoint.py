"""Regression coverage for the Vercel FastAPI discovery entrypoint.

On Vercel the API is served under the ``/api`` path prefix (single-origin
``services`` deployment). The entrypoint is a thin ASGI wrapper that strips that
prefix and delegates to ``main.app`` — so it is no longer identical to
``main.app``, but it must route ``/api``-prefixed requests to the same handlers
and leave unprefixed (local) requests untouched.
"""

import inspect

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
