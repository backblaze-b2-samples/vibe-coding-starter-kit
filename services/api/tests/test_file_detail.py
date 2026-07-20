"""Tests for on-demand rich-metadata recomputation (`GET /files-by-key/detail`).

The endpoint heads the object (existence + size guard), downloads its bytes,
and re-runs the real `extract_metadata()`. Here `get_file_metadata` and
`get_object_bytes` are stubbed at the service module; extraction runs for real.
"""

import hashlib
import io
from datetime import UTC, datetime

import pytest

from app.config import settings
from app.service import files as files_service
from app.types import FileMetadata

TEXT_BYTES = b"hello, world\n"


def _fake_metadata(
    key: str,
    *,
    content_type: str = "text/plain",
    size_bytes: int = len(TEXT_BYTES),
) -> FileMetadata:
    return FileMetadata(
        key=key,
        filename=key.rsplit("/", 1)[-1],
        folder="uploads/",
        size_bytes=size_bytes,
        size_human=f"{size_bytes} B",
        content_type=content_type,
        uploaded_at=datetime.now(UTC),
        url=None,
    )


def _png_bytes(width: int, height: int) -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_detail_returns_checksums_for_text_file(client, monkeypatch):
    monkeypatch.setattr(
        files_service, "get_file_metadata", lambda key: _fake_metadata(key)
    )
    monkeypatch.setattr(files_service, "get_object_bytes", lambda key: TEXT_BYTES)

    resp = await client.get(
        "/files-by-key/detail", params={"key": "uploads/note.txt"}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["md5"] == hashlib.md5(TEXT_BYTES).hexdigest()
    assert body["sha256"] == hashlib.sha256(TEXT_BYTES).hexdigest()
    assert body["extension"] == "txt"
    # Non-image / non-PDF: media/image/pdf fields stay null.
    assert body["image_width"] is None
    assert body["pdf_pages"] is None
    assert body["duration_seconds"] is None


@pytest.mark.asyncio
async def test_detail_extracts_image_dimensions(client, monkeypatch):
    png = _png_bytes(4, 7)
    monkeypatch.setattr(
        files_service,
        "get_file_metadata",
        lambda key: _fake_metadata(
            key, content_type="image/png", size_bytes=len(png)
        ),
    )
    monkeypatch.setattr(files_service, "get_object_bytes", lambda key: png)

    resp = await client.get(
        "/files-by-key/detail", params={"key": "uploads/pixel.png"}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["image_width"] == 4
    assert body["image_height"] == 7


@pytest.mark.asyncio
async def test_detail_missing_file_returns_404(client, monkeypatch):
    monkeypatch.setattr(files_service, "get_file_metadata", lambda key: None)

    resp = await client.get(
        "/files-by-key/detail", params={"key": "uploads/gone.txt"}
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_detail_oversized_file_rejected_without_download(client, monkeypatch):
    def _boom(key):  # pragma: no cover - must never run
        raise AssertionError("oversized object must not be downloaded")

    monkeypatch.setattr(
        files_service,
        "get_file_metadata",
        lambda key: _fake_metadata(
            key, size_bytes=settings.max_file_size + 1
        ),
    )
    monkeypatch.setattr(files_service, "get_object_bytes", _boom)

    resp = await client.get(
        "/files-by-key/detail", params={"key": "uploads/huge.bin"}
    )

    assert resp.status_code == 413
