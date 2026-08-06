"""Unit + integration tests for upload validation and content sniffing."""

import pytest

from app.service import upload as upload_service
from app.service.upload import (
    UploadError,
    matches_content_signature,
    process_upload,
    sanitize_filename,
    validate_extension_matches_type,
)
from app.types import FileUploadResponse

# --- sanitize_filename ------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("../../etc/passwd", "passwd"),  # path components stripped
        ("a\x00b.txt", "ab.txt"),  # null byte removed
        ("my file.txt", "my_file.txt"),  # unsafe char substituted
        ("...hidden", "_hidden"),  # dot run collapses to _ before dot-strip
        ("", "unnamed"),  # empty → placeholder
        ("/", "unnamed"),  # only a path separator → placeholder
    ],
)
def test_sanitize_filename(raw, expected):
    assert sanitize_filename(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "a" * 300 + ".txt",  # long name with extension
        "a" * 300,  # long name, NO extension (regression: was 301 chars + ".")
        "a" * 300 + "." + "b" * 250,  # absurdly long extension
    ],
)
def test_sanitize_filename_truncates_long_names(raw):
    result = sanitize_filename(raw)
    assert len(result) <= 200
    assert not result.startswith(".")


# --- validate_extension_matches_type ----------------------------------------


@pytest.mark.parametrize(
    ("filename", "content_type", "expected"),
    [
        ("photo.jpg", "image/jpeg", True),
        ("photo.jpeg", "image/jpeg", True),
        ("photo.png", "image/jpeg", False),  # extension/type mismatch
        ("noext", "image/jpeg", True),  # no extension → not enforced
        ("x.exe", "image/jpeg", False),
        ("x.pdf", "application/octet-stream", False),  # type not in map
        # Added file types (markdown, configs, datasets, office docs, video).
        ("notes.md", "text/markdown", True),
        ("notes.markdown", "text/markdown", True),
        ("config.yaml", "application/yaml", True),
        ("config.yml", "application/x-yaml", True),
        ("data.jsonl", "application/x-ndjson", True),
        ("data.ndjson", "application/x-ndjson", True),
        ("table.tsv", "text/tab-separated-values", True),
        ("feed.xml", "application/xml", True),
        ("feed.xml", "text/xml", True),
        (
            "report.docx",
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document",
            True,
        ),
        (
            "sheet.xlsx",
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet",
            True,
        ),
        ("clip.mov", "video/quicktime", True),
        ("clip.webm", "video/webm", True),
        ("clip.mp4", "video/quicktime", False),  # extension/type mismatch
    ],
)
def test_validate_extension_matches_type(filename, content_type, expected):
    assert validate_extension_matches_type(filename, content_type) is expected


# --- matches_content_signature ----------------------------------------------

_PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
_JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 8
_PDF = b"%PDF-1.7\n"
_ZIP = b"PK\x03\x04" + b"\x00" * 8


@pytest.mark.parametrize(
    ("data", "content_type", "expected"),
    [
        (_PNG, "image/png", True),
        (b"<html>not a png", "image/png", False),  # spoofed image
        (_JPEG, "image/jpeg", True),
        (_PDF, "application/pdf", True),
        (b"nope", "application/pdf", False),
        (_ZIP, "application/zip", True),
        (b"any text at all", "text/plain", True),  # text has no signature
        (b"{}", "application/json", True),  # json has no signature
    ],
)
def test_matches_content_signature(data, content_type, expected):
    assert matches_content_signature(data, content_type) is expected


# --- process_upload rejection matrix ----------------------------------------


def test_rejects_oversized_content_length(monkeypatch):
    monkeypatch.setattr(upload_service.settings, "max_file_size", 10)
    with pytest.raises(UploadError) as exc:
        process_upload(b"x", "a.txt", "text/plain", content_length=999)
    assert exc.value.status_code == 413


def test_rejects_oversized_body(monkeypatch):
    monkeypatch.setattr(upload_service.settings, "max_file_size", 5)
    with pytest.raises(UploadError) as exc:
        process_upload(b"way too big", "a.txt", "text/plain", content_length=None)
    assert exc.value.status_code == 413


def test_rejects_disallowed_type():
    with pytest.raises(UploadError) as exc:
        process_upload(b"data", "a.exe", "application/x-msdownload", content_length=4)
    assert exc.value.status_code == 415


def test_rejects_extension_mismatch():
    with pytest.raises(UploadError) as exc:
        process_upload(b"data", "a.png", "text/plain", content_length=4)
    assert exc.value.status_code == 415


def test_rejects_content_signature_mismatch():
    # A .png name and declared image/png, but the bytes aren't a PNG.
    with pytest.raises(UploadError) as exc:
        process_upload(b"not a real png", "a.png", "image/png", content_length=14)
    assert exc.value.status_code == 415


def test_rejects_empty_file():
    with pytest.raises(UploadError):
        process_upload(b"", "a.txt", "text/plain", content_length=0)


# --- newly allowed file types pass the full validation gauntlet -------------

_OOXML = b"PK\x03\x04" + b"\x00" * 8  # OOXML files are ZIP containers


@pytest.mark.parametrize(
    ("data", "filename", "content_type"),
    [
        (b"# Title\n\nbody", "notes.md", "text/markdown"),
        (b"key: value\n", "config.yaml", "application/yaml"),
        (b"key: value\n", "config.yml", "application/x-yaml"),
        (b'{"a":1}\n{"a":2}\n', "data.jsonl", "application/x-ndjson"),
        (b"a\tb\tc\n1\t2\t3\n", "table.tsv", "text/tab-separated-values"),
        (b"<root><item/></root>", "feed.xml", "application/xml"),
        (b"<root><item/></root>", "feed.xml", "text/xml"),
        (
            _OOXML,
            "report.docx",
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document",
        ),
        (
            _OOXML,
            "sheet.xlsx",
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet",
        ),
        (
            _OOXML,
            "deck.pptx",
            "application/vnd.openxmlformats-officedocument."
            "presentationml.presentation",
        ),
        (b"\x00" * 16, "clip.mov", "video/quicktime"),
        (b"\x1aE\xdf\xa3" + b"\x00" * 8, "clip.webm", "video/webm"),
    ],
)
def test_accepts_new_filetypes(monkeypatch, data, filename, content_type):
    """Each newly allowed type clears allow-list, extension, and signature checks."""
    monkeypatch.setattr(
        upload_service,
        "upload_file",
        lambda file_data, key, content_type: FileUploadResponse(
            key=key,
            filename=filename,
            size_bytes=len(file_data),
            size_human=f"{len(file_data)} B",
            content_type=content_type,
            uploaded_at="2026-02-14T00:00:00Z",
            url=None,
            metadata=None,
        ),
    )
    monkeypatch.setattr(
        upload_service,
        "extract_metadata",
        lambda file_data, filename, content_type, uploaded_at=None: None,
    )

    result = process_upload(data, filename, content_type, content_length=len(data))
    assert result.content_type == content_type
    assert result.key == f"uploads/{filename}"


# --- uploads_total metric increments ----------------------------------------


@pytest.mark.asyncio
async def test_successful_upload_increments_uploads_metric(client, monkeypatch):
    from app.runtime import metrics

    monkeypatch.setattr(metrics, "_upload_count", 0)
    monkeypatch.setattr(
        upload_service,
        "upload_file",
        lambda file_data, key, content_type: FileUploadResponse(
            key=key,
            filename="a.txt",
            size_bytes=len(file_data),
            size_human="5 B",
            content_type=content_type,
            uploaded_at="2026-02-14T00:00:00Z",
            url=None,
            metadata=None,
        ),
    )
    monkeypatch.setattr(
        upload_service,
        "extract_metadata",
        lambda file_data, filename, content_type, uploaded_at=None: None,
    )

    resp = await client.post(
        "/upload", files={"file": ("a.txt", b"hello", "text/plain")}
    )
    assert resp.status_code == 200

    metrics_resp = await client.get("/metrics")
    assert "uploads_total 1" in metrics_resp.text
