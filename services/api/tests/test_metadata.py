"""Unit tests for file metadata extraction.

These exercise the real Pillow / pypdf code paths with in-memory fixtures — no
network, no B2. They cover the hash/extension fields plus image and PDF
extraction, and confirm corrupt inputs degrade gracefully rather than raising.
"""

import hashlib
import io

from app.service.metadata import extract_metadata


def test_extract_metadata_text_has_no_media_fields():
    data = b"hello world"
    detail = extract_metadata(data, "notes.txt", "text/plain")

    assert detail.filename == "notes.txt"
    assert detail.extension == "txt"
    assert detail.size_bytes == len(data)
    assert detail.size_human == "11.0 B"
    assert detail.md5 == hashlib.md5(data, usedforsecurity=False).hexdigest()
    assert detail.sha256 == hashlib.sha256(data).hexdigest()
    # No image/PDF fields for a plain text file.
    assert detail.image_width is None
    assert detail.pdf_pages is None


def test_extract_metadata_extensionless_filename():
    detail = extract_metadata(b"x", "README", "text/plain")
    assert detail.extension == ""


def test_extract_metadata_image_reads_dimensions():
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (10, 20)).save(buf, format="PNG")
    detail = extract_metadata(buf.getvalue(), "pic.png", "image/png")

    assert detail.image_width == 10
    assert detail.image_height == 20


def test_extract_metadata_corrupt_image_degrades_gracefully():
    """An image content-type with non-image bytes must not raise — the base
    fields still come back, media fields stay None."""
    detail = extract_metadata(b"definitely not a png", "fake.png", "image/png")

    assert detail.image_width is None
    assert detail.image_height is None
    # Hashes/extension are still computed from the raw bytes.
    assert detail.extension == "png"
    assert detail.md5


def test_extract_metadata_pdf_counts_pages():
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.add_blank_page(width=72, height=72)
    buf = io.BytesIO()
    writer.write(buf)

    detail = extract_metadata(buf.getvalue(), "doc.pdf", "application/pdf")
    assert detail.pdf_pages == 2
