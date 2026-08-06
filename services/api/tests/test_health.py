"""Integration tests for the health endpoint."""

import socket

import pytest

from app.repo import b2_client
from app.runtime import health as health_runtime


def test_normal_suite_blocks_network():
    with (
        socket.socket() as client_socket,
        pytest.raises(AssertionError, match="External network access is forbidden"),
    ):
        client_socket.connect(("203.0.113.1", 443))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("b2_connected", "expected_status"),
    [(True, "healthy"), (False, "degraded")],
)
async def test_health_reports_connectivity(
    client, monkeypatch, b2_connected, expected_status
):
    monkeypatch.setattr(
        health_runtime, "check_connectivity", lambda: b2_connected
    )

    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": expected_status,
        "b2_connected": b2_connected,
    }


def test_s3_client_has_bounded_network_waits(monkeypatch):
    captured = {}

    def fake_client(*_args, **kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(b2_client.boto3, "client", fake_client)
    b2_client.get_s3_client.cache_clear()

    b2_client.get_s3_client()

    config = captured["config"]
    assert config.connect_timeout == 5
    assert config.read_timeout == 30
    assert config.retries == {"mode": "standard", "total_max_attempts": 3}


@pytest.mark.asyncio
async def test_metrics_returns_200(client):
    response = await client.get("/metrics")
    assert response.status_code == 200
    assert "http_requests_total" in response.text
    assert "uploads_total" in response.text
