"""Vercel-recognized FastAPI entrypoint.

Vercel discovers a FastAPI ``app`` exported from ``index.py`` at the project
root. Keep the application definition in ``main.py`` so local Uvicorn and tests
continue to share the exact same routes, middleware, and lifespan.

On Vercel the web app and this API are one project sharing a single origin (see
``vercel.json`` ``services``). Public API calls arrive under the ``/api`` path
prefix, and Vercel forwards that original path to this ASGI app. This entrypoint
is Vercel-only, so it strips the leading ``/api`` segment here and delegates to
``main.app`` with its native paths (``/health``, ``/files``, ...). ``main.app``,
its routes, the OpenAPI contract, and local/uvicorn/test invocation stay
unchanged — the prefix exists only in production, only in this file.
"""

from main import app as _app

_PREFIX = "/api"


def _strip_prefix(scope: dict) -> dict:
    """Return a copy of ``scope`` with the ``/api`` public prefix removed.

    Pure and side-effect free so it can be unit-tested without booting the app.
    A path that does not start with ``/api`` is returned unchanged, so local
    (unprefixed) invocation is unaffected.
    """
    path = scope.get("path", "")
    if path != _PREFIX and not path.startswith(_PREFIX + "/"):
        return scope

    stripped = dict(scope)
    stripped["path"] = path[len(_PREFIX) :] or "/"
    raw = scope.get("raw_path")
    if isinstance(raw, (bytes, bytearray)) and raw.startswith(_PREFIX.encode()):
        stripped["raw_path"] = raw[len(_PREFIX) :] or b"/"
    return stripped


async def app(scope, receive, send):
    """ASGI wrapper: strip ``/api`` for HTTP/WebSocket, pass lifespan through."""
    if scope["type"] in ("http", "websocket"):
        scope = _strip_prefix(scope)
    await _app(scope, receive, send)


__all__ = ["app"]
