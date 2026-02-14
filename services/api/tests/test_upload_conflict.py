"""Unit tests for upload filename conflicts."""

import pytest

from app.service import upload as upload_service
from app.types import FileUploadResponse


def test_upload_rejects_duplicate_filename(monkeypatch):
    monkeypatch.setattr(
        upload_service,
        "get_file_metadata",
        lambda key: object(),
    )

    with pytest.raises(upload_service.UploadError) as exc:
        upload_service.process_upload(
            file_data=b"hello",
            filename="report.txt",
            content_type="text/plain",
            content_length=5,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "File already exists"


def test_upload_uses_original_filename(monkeypatch):
    monkeypatch.setattr(upload_service, "get_file_metadata", lambda key: None)
    monkeypatch.setattr(
        upload_service,
        "upload_file",
        lambda file_data, key, content_type: FileUploadResponse(
            key=key,
            filename="report.txt",
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
        lambda file_data, filename, content_type: None,
    )

    result = upload_service.process_upload(
        file_data=b"hello",
        filename="report.txt",
        content_type="text/plain",
        content_length=5,
    )

    assert result.key == "uploads/report.txt"
