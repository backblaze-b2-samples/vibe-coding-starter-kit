"""Vercel-recognized FastAPI entrypoint.

Vercel discovers a FastAPI ``app`` exported from ``index.py`` at the project
root. Keep the application definition in ``main.py`` so local Uvicorn and
tests continue to share the exact same middleware and lifespan configuration.
"""

from main import app

__all__ = ["app"]
