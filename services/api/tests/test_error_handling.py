"""Tests for error handling across the API."""

import pytest

from app.service import files as files_service


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500(client, monkeypatch):
    """Global handler catches unhandled exceptions and returns 500 JSON."""

    def explode(**kwargs):
        raise RuntimeError("B2 exploded")

    monkeypatch.setattr(files_service, "list_files", explode)

    response = await client.get("/files")
    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == "Internal server error"
    # Ensure raw error message is NOT leaked to the client
    assert "B2 exploded" not in body["detail"]


@pytest.mark.asyncio
async def test_stats_b2_failure_returns_500(client, monkeypatch):
    """Stats endpoint returns 500 when B2 is unreachable."""

    def explode():
        raise RuntimeError("B2 stats query failed")

    monkeypatch.setattr(files_service, "get_upload_stats", explode)

    response = await client.get("/files/stats")
    assert response.status_code == 500
    assert response.json()["detail"] == "Internal server error"


@pytest.mark.asyncio
async def test_download_not_found_returns_404(client, monkeypatch):
    """Download for a missing file returns 404 with detail."""
    monkeypatch.setattr(files_service, "get_file_metadata", lambda key: None)

    response = await client.get("/files/uploads/missing.txt/download")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_key_returns_400(client):
    """Keys without allowed prefix are rejected with 400."""
    response = await client.get("/files/notallowed/secret.txt")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_upload_empty_file_returns_400(client):
    """Uploading an empty file returns 400 with explanation."""
    from io import BytesIO

    response = await client.post(
        "/upload",
        files={"file": ("empty.txt", BytesIO(b""), "text/plain")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()
