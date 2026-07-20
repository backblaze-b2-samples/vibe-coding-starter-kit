import logging
import re
from collections import defaultdict
from datetime import UTC, datetime, timedelta

from app.config import settings
from app.repo import (
    delete_file,
    get_download_count,
    get_file_metadata,
    get_object_bytes,
    get_presigned_url,
    get_upload_stats,
    increment_download_count,
    list_files,
)
from app.service.metadata import extract_metadata
from app.types import FileMetadata, FileMetadataDetail, UploadStats
from app.types.formatting import humanize_bytes
from app.types.stats import DailyUploadCount

logger = logging.getLogger(__name__)

_DANGEROUS_KEY_RE = re.compile(r"(\.\./|/\.\.|\\|%2e%2e|%00|\x00)")


class FileKeyError(Exception):
    """Raised when a file key is invalid."""

    def __init__(self, detail: str = "Invalid file key"):
        self.detail = detail
        super().__init__(detail)


class FileNotFoundServiceError(Exception):
    """Raised when a file is not found.

    Named distinctly from the built-in ``FileNotFoundError`` so it never
    shadows it at module scope — code here (and in callers) can rely on the
    built-in meaning what it says.
    """

    def __init__(self, detail: str = "File not found"):
        self.detail = detail
        super().__init__(detail)


class FileTooLargeServiceError(Exception):
    """Raised when an object is too large to recompute detailed metadata for.

    Detailed extraction downloads and buffers the whole object in memory, so
    objects above the upload size ceiling are refused rather than risking the
    API process's memory.
    """

    def __init__(self, detail: str = "File too large for detailed metadata"):
        self.detail = detail
        super().__init__(detail)


def validate_key(key: str) -> None:
    """Reject empty keys, path-traversal patterns, and — when configured — keys
    outside the allowed prefix.

    `settings.allowed_key_prefix` is empty by default, so any key shape is
    accepted (the by-key routes deliberately support arbitrary folders and
    reserved-word segments). Set it to confine key ops to a prefix like
    "uploads/" when the bucket also holds non-app data.
    """
    if not key:
        raise FileKeyError()
    if _DANGEROUS_KEY_RE.search(key.lower()):
        raise FileKeyError()
    prefix = settings.allowed_key_prefix
    if prefix and not key.startswith(prefix):
        raise FileKeyError()


def get_files(prefix: str = "", limit: int = 100) -> list[FileMetadata]:
    if limit < 1 or limit > 1000:
        raise ValueError("Limit must be between 1 and 1000")
    # list_files paginates the whole prefix (not just the first 1000 keys).
    # Sort newest-first here so the endpoint's "recent uploads" contract holds
    # regardless of repo ordering, then slice to the requested limit.
    files = list_files(prefix=prefix)
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
        raise FileNotFoundServiceError()
    return metadata


def get_file_detail(key: str) -> FileMetadataDetail:
    """Recompute rich metadata (checksums, image/PDF fields) for a stored object.

    Extraction runs at upload time and is not persisted, so the Files browser
    would otherwise only ever see the core object fields. This downloads the
    object on demand and re-runs the same `extract_metadata()` used at upload.

    It buffers the whole object in memory, so we `head` first to reject objects
    above `max_file_size` before downloading. Raises FileKeyError (invalid key),
    FileNotFoundServiceError (missing / deleted mid-read), or
    FileTooLargeServiceError (over the ceiling).
    """
    validate_key(key)
    metadata = get_file_metadata(key)
    if not metadata:
        raise FileNotFoundServiceError()
    if metadata.size_bytes > settings.max_file_size:
        raise FileTooLargeServiceError(
            "File too large for detailed metadata. "
            f"Max size: {humanize_bytes(settings.max_file_size)}"
        )
    data = get_object_bytes(key)
    return extract_metadata(data, metadata.filename, metadata.content_type)


def get_preview_url(key: str) -> str:
    """Return a presigned URL without recording a download.

    Used by the preview modal for rendering images / PDFs inline — opening
    a preview is not a user-initiated download and shouldn't inflate the
    download counter.
    """
    validate_key(key)
    metadata = get_file_metadata(key)
    if not metadata:
        raise FileNotFoundServiceError()
    return get_presigned_url(key, filename=metadata.filename)


def get_download_url(key: str) -> str:
    """Return a presigned URL and record the event as a download."""
    url = get_preview_url(key)
    increment_download_count()
    return url


def remove_file(key: str) -> None:
    """Validate key and delete the file. Raises RuntimeError on B2 failure."""
    validate_key(key)
    delete_file(key)


def get_upload_activity(days: int = 7) -> list[DailyUploadCount]:
    """Return daily upload counts for the last N days."""
    files = list_files(prefix="")
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
