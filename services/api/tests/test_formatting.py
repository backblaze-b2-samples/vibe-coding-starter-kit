"""Unit tests for the human-readable byte formatter."""

import pytest

from app.types.formatting import humanize_bytes

KB = 1024
MB = 1024**2
GB = 1024**3
TB = 1024**4
PB = 1024**5


@pytest.mark.parametrize(
    ("size", "expected"),
    [
        (0, "0.0 B"),
        (512, "512.0 B"),
        (1023, "1023.0 B"),
        (KB, "1.0 KB"),
        (KB + KB // 2, "1.5 KB"),
        (MB, "1.0 MB"),
        (GB, "1.0 GB"),
        (TB, "1.0 TB"),
        (PB, "1.0 PB"),
    ],
)
def test_humanize_bytes(size, expected):
    assert humanize_bytes(size) == expected


def test_humanize_bytes_rolls_up_at_each_boundary():
    """Each unit kicks in at exactly 1024 of the previous unit."""
    assert humanize_bytes(KB - 1) == "1023.0 B"
    assert humanize_bytes(MB - 1).endswith(" KB")
    assert humanize_bytes(GB).endswith(" GB")
