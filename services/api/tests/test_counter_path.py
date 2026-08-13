"""Tests for counter-path anchoring across full-repo and service-only layouts.

`_counter_path()` walks up from this module's `__file__` to the repo root so
runtime state stays outside `uvicorn --reload`'s watch tree. A deployment that
ships *only* services/api has no repo root above it — Railway with the service
root directory set to services/api, or a Docker build that copies just this
directory — and indexing past the filesystem root raised IndexError at import
time, taking the whole API down before it could serve a request. Both layouts
are pinned here so the anchoring cannot silently regress to either extreme.
"""

from pathlib import Path

import pytest

from app.config import settings
from app.repo import counter

RELATIVE_DEFAULT = ".data/download_count.json"


def _resolve_with_file(monkeypatch: pytest.MonkeyPatch, fake_file: str) -> Path:
    """Resolve the counter path as if this module lived at `fake_file`."""
    monkeypatch.setattr(counter, "__file__", fake_file)
    monkeypatch.setattr(settings, "download_count_file", RELATIVE_DEFAULT)
    return counter._counter_path()


def test_anchors_at_repo_root_in_a_full_checkout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """repo/ -> services/ -> api/ -> app/ -> repo/ -> counter.py."""
    path = _resolve_with_file(
        monkeypatch, "/src/checkout/services/api/app/repo/counter.py"
    )
    assert path == Path("/src/checkout") / RELATIVE_DEFAULT


def test_anchors_at_service_root_when_only_the_service_is_deployed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """/app/ -> app/ -> repo/ -> counter.py, with no repo root above it."""
    path = _resolve_with_file(monkeypatch, "/app/app/repo/counter.py")
    assert path == Path("/app") / RELATIVE_DEFAULT


def test_absolute_setting_bypasses_anchoring(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "download_count_file", "/var/lib/vcsk/count.json")
    assert counter._counter_path() == Path("/var/lib/vcsk/count.json")
