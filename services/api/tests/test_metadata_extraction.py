"""Behavior of the image and PDF metadata extractors on well-formed files.

`test_metadata_warning.py` covers the failure paths. These tests pin the
success paths (dimensions, EXIF tags, PDF page count, author and title) so a
Pillow or PDF-library upgrade cannot silently change what the detail panel
shows. The PDF fixture is built by hand from the PDF 1.4 syntax, not by the
library under test, so the expected values are independent of it.
"""

import io

from PIL import Image

from app.service.metadata import extract_metadata

# EXIF tag ids from the EXIF 2.32 specification (IFD0).
_EXIF_MAKE = 0x010F
_EXIF_MODEL = 0x0110
_EXIF_ARTIST = 0x013B


def _jpeg_with_exif(width: int = 8, height: int = 6) -> bytes:
    exif = Image.Exif()
    exif[_EXIF_MAKE] = "ExampleCam"
    exif[_EXIF_MODEL] = "Model 1"
    exif[_EXIF_ARTIST] = "Test Artist"
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (200, 100, 50)).save(
        buffer, format="JPEG", exif=exif
    )
    return buffer.getvalue()


def _minimal_pdf(pages: int, author: str, title: str) -> bytes:
    """Assemble a valid PDF with `pages` empty pages and an Info dictionary."""
    page_ids = [4 + index for index in range(pages)]
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids ["
        + b" ".join(f"{pid} 0 R".encode() for pid in page_ids)
        + f"] /Count {pages} >>".encode(),
        f"<< /Author ({author}) /Title ({title}) >>".encode(),
    ]
    objects += [
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>" for _ in page_ids
    ]

    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n".encode() + body + b"\nendobj\n")
    xref_at = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n".encode())
    out.write(b"0000000000 65535 f \n")
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info 3 0 R >>\n".encode()
    )
    out.write(f"startxref\n{xref_at}\n%%EOF\n".encode())
    return out.getvalue()


def test_jpeg_reports_dimensions_and_exif_tags_by_name():
    detail = extract_metadata(_jpeg_with_exif(), "photo.jpg", "image/jpeg")

    assert detail.image_width == 8
    assert detail.image_height == 6
    assert detail.metadata_warning is None
    assert detail.exif is not None
    assert detail.exif["Make"] == "ExampleCam"
    assert detail.exif["Model"] == "Model 1"
    assert detail.exif["Artist"] == "Test Artist"


def test_image_without_exif_reports_no_exif_section():
    buffer = io.BytesIO()
    Image.new("RGB", (3, 5)).save(buffer, format="PNG")

    detail = extract_metadata(buffer.getvalue(), "plain.png", "image/png")

    assert (detail.image_width, detail.image_height) == (3, 5)
    assert detail.exif is None


def test_pdf_reports_page_count_author_and_title():
    payload = _minimal_pdf(pages=3, author="Jane Doe", title="Quarterly Report")

    detail = extract_metadata(payload, "report.pdf", "application/pdf")

    assert detail.metadata_warning is None
    assert detail.pdf_pages == 3
    assert detail.pdf_author == "Jane Doe"
    assert detail.pdf_title == "Quarterly Report"
