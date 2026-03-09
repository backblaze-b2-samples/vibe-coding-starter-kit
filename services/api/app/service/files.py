import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from threading import Lock

from app.repo import (
    delete_file,
    get_file_metadata,
    get_presigned_url,
    get_upload_stats,
    list_files,
)
from app.types import FileMetadata, UploadStats
from app.types.stats import DailyUploadCount

_ALLOWED_PREFIXES = ("uploads/",)
_DANGEROUS_KEY_RE = re.compile(r"(\.\./|/\.\.|\\|%2e%2e|%00|\x00)")
_download_lock = Lock()
_download_count = 0


def _record_download() -> None:
    global _download_count
    with _download_lock:
        _download_count += 1


def get_download_count() -> int:
    with _download_lock:
        return _download_count


class FileKeyError(Exception):
    """Raised when a file key is invalid."""

    def __init__(self, detail: str = "Invalid file key"):
        self.detail = detail
        super().__init__(detail)


class FileNotFoundError(Exception):
    """Raised when a file is not found."""

    def __init__(self, detail: str = "File not found"):
        self.detail = detail
        super().__init__(detail)


def validate_key(key: str) -> None:
    """Reject keys that could escape the allowed prefix or contain traversal."""
    if not key or not any(key.startswith(p) for p in _ALLOWED_PREFIXES):
        raise FileKeyError()
    if _DANGEROUS_KEY_RE.search(key.lower()):
        raise FileKeyError()


def get_files(prefix: str = "", limit: int = 100) -> list[FileMetadata]:
    if limit < 1 or limit > 1000:
        raise ValueError("Limit must be between 1 and 1000")
    # S3 list_objects_v2 returns objects in lexicographic order, not by date.
    # Fetch a full batch, sort newest-first, then slice to the requested limit.
    files = list_files(prefix=prefix, max_keys=1000)
    files.sort(key=lambda f: f.uploaded_at, reverse=True)
    return files[:limit]


def get_stats() -> UploadStats:
    data = get_upload_stats()
    data["total_downloads"] = get_download_count()
    return UploadStats(**data)


def get_file(key: str) -> FileMetadata:
    validate_key(key)
    metadata = get_file_metadata(key)
    if not metadata:
        raise FileNotFoundError()
    return metadata


def get_download_url(key: str) -> str:
    validate_key(key)
    metadata = get_file_metadata(key)
    if not metadata:
        raise FileNotFoundError()
    url = get_presigned_url(key, filename=metadata.filename)
    _record_download()
    return url


def remove_file(key: str) -> None:
    """Validate key and delete the file. Raises RuntimeError on B2 failure."""
    validate_key(key)
    delete_file(key)


def get_upload_activity(days: int = 7) -> list[DailyUploadCount]:
    """Return daily upload counts for the last N days."""
    files = list_files(prefix="", max_keys=1000)
    today = datetime.now(UTC).date()
    cutoff = today - timedelta(days=days - 1)

    counts: dict[str, int] = defaultdict(int)
    for f in files:
        d = f.uploaded_at.date()
        if d >= cutoff:
            counts[d.isoformat()] += 1

    # Fill in missing days with zero
    return [
        DailyUploadCount(
            date=(cutoff + timedelta(days=i)).isoformat(),
            uploads=counts.get((cutoff + timedelta(days=i)).isoformat(), 0),
        )
        for i in range(days)
    ]
