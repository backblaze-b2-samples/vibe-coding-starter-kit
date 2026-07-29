"""Preview presigns must be `inline`; downloads must stay `attachment`.

A preview URL that answers with `Content-Disposition: attachment` can never
render in an `<iframe>` — the browser starts a download instead — so the
advertised inline PDF preview is impossible. `<img>` ignores the header, which
is why images masked the bug.
"""

from datetime import UTC, datetime

import pytest

from app.repo import b2_client
from app.service import files as files_service
from app.types import FileMetadata


class _FakeS3Client:
    """Captures the params boto3 would have signed."""

    def __init__(self):
        self.params: dict | None = None

    def generate_presigned_url(self, _client_method, Params, ExpiresIn):
        # PascalCase kwargs mirror the boto3 signature this stands in for.
        self.params = Params
        self.expires_in = ExpiresIn
        return "https://example.invalid/signed"


@pytest.fixture
def fake_s3(monkeypatch):
    client = _FakeS3Client()
    monkeypatch.setattr(b2_client, "get_s3_client", lambda: client)
    return client


def test_repo_defaults_to_attachment(fake_s3):
    b2_client.get_presigned_url("uploads/report.pdf", filename="report.pdf")
    disposition = fake_s3.params["ResponseContentDisposition"]
    assert disposition.startswith("attachment;")
    assert "report.pdf" in disposition


def test_repo_inline_disposition(fake_s3):
    b2_client.get_presigned_url(
        "uploads/report.pdf", filename="report.pdf", disposition="inline"
    )
    disposition = fake_s3.params["ResponseContentDisposition"]
    assert disposition.startswith("inline;")
    assert "report.pdf" in disposition


def test_repo_inline_without_filename(fake_s3):
    b2_client.get_presigned_url("uploads/report.pdf", disposition="inline")
    assert fake_s3.params["ResponseContentDisposition"] == "inline"


def test_repo_rejects_unknown_disposition(fake_s3):
    with pytest.raises(ValueError):
        b2_client.get_presigned_url("uploads/report.pdf", disposition="sideways")


def _stub_metadata(monkeypatch) -> list[dict]:
    """Point the service at a fake object and capture presign kwargs."""
    calls: list[dict] = []

    def fake_metadata(key: str) -> FileMetadata:
        return FileMetadata(
            key=key,
            filename="report.pdf",
            folder="uploads/",
            size_bytes=1024,
            size_human="1.0 KB",
            content_type="application/pdf",
            uploaded_at=datetime.now(UTC),
            url=None,
        )

    def fake_presign(key: str, filename=None, disposition="attachment") -> str:
        calls.append(
            {"key": key, "filename": filename, "disposition": disposition}
        )
        return f"https://example.invalid/{disposition}"

    monkeypatch.setattr(files_service, "get_file_metadata", fake_metadata)
    monkeypatch.setattr(files_service, "get_presigned_url", fake_presign)
    return calls


def test_service_preview_asks_for_inline(monkeypatch):
    calls = _stub_metadata(monkeypatch)
    files_service.get_preview_url("uploads/report.pdf")
    assert calls[-1]["disposition"] == "inline"


def test_service_download_asks_for_attachment(monkeypatch):
    calls = _stub_metadata(monkeypatch)
    files_service.get_download_url("uploads/report.pdf")
    assert calls[-1]["disposition"] == "attachment"


def test_preview_and_download_dispositions_differ(monkeypatch):
    calls = _stub_metadata(monkeypatch)
    files_service.get_preview_url("uploads/report.pdf")
    files_service.get_download_url("uploads/report.pdf")
    assert [c["disposition"] for c in calls] == ["inline", "attachment"]


@pytest.mark.asyncio
async def test_preview_route_uses_inline(client, monkeypatch):
    calls = _stub_metadata(monkeypatch)
    response = await client.get(
        "/files-by-key/preview", params={"key": "uploads/report.pdf"}
    )
    assert response.status_code == 200
    assert calls[-1]["disposition"] == "inline"


@pytest.mark.asyncio
async def test_download_route_uses_attachment(client, monkeypatch):
    calls = _stub_metadata(monkeypatch)
    response = await client.get(
        "/files-by-key/download", params={"key": "uploads/report.pdf"}
    )
    assert response.status_code == 200
    assert calls[-1]["disposition"] == "attachment"
