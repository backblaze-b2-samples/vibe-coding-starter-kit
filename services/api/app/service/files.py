import re

from app.repo import (
    delete_file,
    get_file_metadata,
    get_presigned_url,
    get_upload_stats,
    list_files,
)
from app.types import FileMetadata, UploadStats

_ALLOWED_PREFIXES = ("uploads/",)
_DANGEROUS_KEY_RE = re.compile(r"(\.\./|/\.\.|\\|%2e%2e|%00|\x00)")


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
    return list_files(prefix=prefix, max_keys=limit)


def get_stats() -> UploadStats:
    data = get_upload_stats()
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
    return get_presigned_url(key, filename=metadata.filename)


def remove_file(key: str) -> bool:
    validate_key(key)
    success = delete_file(key)
    if not success:
        raise RuntimeError("Failed to delete file")
    return True
