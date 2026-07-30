"""Regression coverage for the Vercel FastAPI discovery entrypoint."""

from index import app as vercel_app
from main import app


def test_vercel_entrypoint_exports_the_main_application():
    assert vercel_app is app
