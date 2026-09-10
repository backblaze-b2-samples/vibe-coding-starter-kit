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
    # Tell the app it is mounted under /api so FastAPI prepends the prefix to the
    # URLs it *generates* — trailing-slash 307 redirects and the Swagger/ReDoc
    # `openapi_url` — which would otherwise point at the bare origin and miss the
    # `/api` rewrite (a 404 routed to the web service). Routing still matches on
    # the stripped `path` above; this is exactly how `uvicorn --root-path /api`
    # presents a proxied mount.
    stripped["root_path"] = _PREFIX
    raw = scope.get("raw_path")
    prefix_bytes = _PREFIX.encode()
    if isinstance(raw, (bytes, bytearray)) and (
        raw == prefix_bytes or raw.startswith(prefix_bytes + b"/")
    ):
        stripped["raw_path"] = raw[len(_PREFIX) :] or b"/"
    return stripped


async def app(scope, receive, send):
    """ASGI wrapper: strip ``/api`` from inbound HTTP/WebSocket paths and
    delegate to ``main.app``. Lifespan (and any other scope type) passes through
    untouched, so startup validation and the cache warm still run.

    Known minor limitation: Starlette's automatic trailing-slash 307 emits an
    *absolute*, same-origin ``Location`` without the ``/api`` prefix, so a
    hand-typed ``/api/foo/`` bounces to the web service. The app's own client
    always uses canonical, no-trailing-slash paths, so real traffic never hits
    it; ``root_path`` (set in ``_strip_prefix``) already fixes the case that
    matters — the Swagger/ReDoc ``openapi_url``.
    """
    if scope["type"] in ("http", "websocket"):
        scope = _strip_prefix(scope)
    await _app(scope, receive, send)


__all__ = ["app"]
