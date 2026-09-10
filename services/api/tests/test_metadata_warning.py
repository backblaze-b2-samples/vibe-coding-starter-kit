"""A skipped format extractor must be reported, not silently omitted.

An image above Pillow's decompression-bomb ceiling used to return a detail
payload with no Image section and no explanation, so the UI looked like the
file simply had no dimensions/EXIF. The safety limit stays; the skip is now
surfaced in `metadata_warning`.
"""

import io

import pytest
from PIL import Image

from app.service.metadata import extract_metadata


def _png_bytes(width: int = 4, height: int = 4) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (10, 20, 30)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_decodable_image_has_dimensions_and_no_warning():
    detail = extract_metadata(_png_bytes(), "tiny.png", "image/png")
    assert detail.image_width == 4
    assert detail.image_height == 4
    assert detail.metadata_warning is None


def test_decompression_bomb_limit_is_reported(monkeypatch):
    """Keep the bomb guard, but tell the user why the Image section is gone."""
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1)

    detail = extract_metadata(_png_bytes(), "huge.png", "image/png")

    assert detail.image_width is None
    assert detail.image_height is None
    assert detail.metadata_warning is not None
    assert "decompression-bomb" in detail.metadata_warning
    # Core fields still exact — the warning must not imply the file is broken.
    assert detail.md5
    assert detail.sha256
    assert detail.size_bytes == len(_png_bytes())


def test_undecodable_image_is_reported():
    detail = extract_metadata(b"not an image at all", "broken.png", "image/png")
    assert detail.image_width is None
    assert detail.metadata_warning is not None
    assert "could not be decoded" in detail.metadata_warning


def test_unparseable_pdf_is_reported():
    detail = extract_metadata(b"%PDF-1.4 truncated", "broken.pdf", "application/pdf")
    assert detail.pdf_pages is None
    assert detail.metadata_warning is not None
    assert detail.metadata_warning.startswith("PDF metadata unavailable")


def test_non_media_types_carry_no_warning():
    detail = extract_metadata(b"col_a,col_b\n1,2\n", "data.csv", "text/csv")
    assert detail.metadata_warning is None


@pytest.mark.asyncio
async def test_detail_route_exposes_the_warning(client, monkeypatch):
    """The field has to survive the response model, not just the service."""
    from datetime import UTC, datetime

    from app.service import files as files_service
    from app.types import FileMetadata

    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1)
    payload = _png_bytes()

    monkeypatch.setattr(
        files_service,
        "get_file_metadata",
        lambda key: FileMetadata(
            key=key,
            filename="huge.png",
            folder="uploads/",
            size_bytes=len(payload),
            size_human="1.0 KB",
            content_type="image/png",
            uploaded_at=datetime.now(UTC),
            url=None,
        ),
    )
    monkeypatch.setattr(files_service, "get_object_bytes", lambda key: payload)

    response = await client.get(
        "/files-by-key/detail", params={"key": "uploads/huge.png"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["image_width"] is None
    assert "decompression-bomb" in body["metadata_warning"]
