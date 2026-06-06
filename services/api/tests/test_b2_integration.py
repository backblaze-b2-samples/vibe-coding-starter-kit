"""Integration tests against a REAL Backblaze B2 bucket.

These are the only tests that exercise `app/repo/b2_client.py` end-to-end — every
other test in this suite monkeypatches the B2 layer. They are auto-skipped unless
real B2 credentials are configured (via the repo-root `.env` or environment
variables), so the default `pnpm test:api` stays hermetic and credential-free.

Run explicitly with:  pytest -m integration

Every object is written under a unique `ci-int/<uuid>/` prefix and removed in the
fixture's finally-block, so a failed assertion never leaves residue in the bucket.
"""

import contextlib
import uuid

import httpx
import pytest

# Importing main loads the repo-root .env into the environment (see main.py),
# so `settings` below reflects any real creds the operator has configured.
from app.config import settings
from main import PLACEHOLDER_VALUES, REQUIRED_B2_SETTINGS


def _b2_configured() -> bool:
    """True only when every required B2 setting is present and not a placeholder.

    Mirrors main.py's startup validation so an unedited `.env.example` copy is
    treated as 'not configured' (skip) rather than producing 403s from B2.
    """
    for attr, _env_name in REQUIRED_B2_SETTINGS:
        value = getattr(settings, attr)
        if not value or value in PLACEHOLDER_VALUES:
            return False
    return True


pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not _b2_configured(),
        reason="B2 credentials not configured — set them in .env to run integration tests",
    ),
]


@pytest.fixture
def b2_key():
    """Yield a unique throwaway object key, then delete it no matter what."""
    from app.repo import b2_client

    key = f"ci-int/{uuid.uuid4().hex}/hello.txt"
    try:
        yield key
    finally:
        # Best-effort cleanup — never let teardown mask the test's own failure.
        with contextlib.suppress(Exception):
            b2_client.delete_file(key)


def test_b2_round_trip(b2_key):
    """Full lifecycle through the real B2 client: connect → upload → head →
    list → stats → presigned download → delete → confirm gone."""
    from app.repo import b2_client

    body = b"hello backblaze\n"

    assert b2_client.check_connectivity() is True

    # upload
    meta = b2_client.upload_file(body, b2_key, "text/plain")
    assert meta.key == b2_key
    assert meta.size_bytes == len(body)

    # head / metadata
    fetched = b2_client.get_file_metadata(b2_key)
    assert fetched is not None
    assert fetched.size_bytes == len(body)

    # list under our unique prefix
    prefix = b2_key.rsplit("/", 1)[0] + "/"
    listed = b2_client.list_files(prefix=prefix)
    assert any(f.key == b2_key for f in listed)

    # aggregate stats include at least our object
    stats = b2_client.get_upload_stats()
    assert stats["total_files"] >= 1

    # presigned URL actually serves the uploaded bytes
    url = b2_client.get_presigned_url(b2_key, filename="hello.txt")
    resp = httpx.get(url, timeout=30)
    assert resp.status_code == 200
    assert resp.content == body

    # delete → object is gone
    b2_client.delete_file(b2_key)
    assert b2_client.get_file_metadata(b2_key) is None


def test_get_file_metadata_missing_key_returns_none():
    """A head against a key that doesn't exist returns None (404), not an error."""
    from app.repo import b2_client

    missing = f"ci-int/{uuid.uuid4().hex}/does-not-exist.txt"
    assert b2_client.get_file_metadata(missing) is None
