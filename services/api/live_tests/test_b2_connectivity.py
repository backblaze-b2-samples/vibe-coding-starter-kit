"""Explicit live B2 connectivity test, excluded from the normal testpaths."""

import os

import pytest

from app.repo import check_connectivity


@pytest.mark.live
def test_real_b2_connectivity():
    if os.environ.get("RUN_LIVE_B2_TESTS") != "1":
        pytest.skip("set RUN_LIVE_B2_TESTS=1 to allow a real B2 request")

    assert check_connectivity(), "B2 connectivity check returned degraded"
