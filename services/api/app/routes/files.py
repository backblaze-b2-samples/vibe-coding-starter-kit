import re

from fastapi import APIRouter, HTTPException

from app.models import FileMetadata, UploadStats
from app.services.b2_s3 import (
    list_files,
    get_file_metadata,
    delete_file,
    get_presigned_url,
    get_upload_stats,
)

router = APIRouter()

# Allowed key prefixes — keys must start with one of these
_ALLOWED_PREFIXES = ("uploads/",)

# Reject path traversal sequences and null bytes
_DANGEROUS_KEY_RE = re.compile(r"(\.\./|/\.\.|\\|%2e%2e|%00|\x00)")


def _validate_key(key: str) -> None:
    """Reject keys that could escape the allowed prefix or contain traversal."""
    if not key or not any(key.startswith(p) for p in _ALLOWED_PREFIXES):
        raise HTTPException(status_code=400, detail="Invalid file key")
    if _DANGEROUS_KEY_RE.search(key.lower()):
        raise HTTPException(status_code=400, detail="Invalid file key")


@router.get("/files", response_model=list[FileMetadata])
async def get_files(prefix: str = "", limit: int = 100):
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 1000")
    return list_files(prefix=prefix, max_keys=limit)


@router.get("/files/stats", response_model=UploadStats)
async def get_stats():
    return get_upload_stats()


@router.get("/files/{key:path}/download")
async def download_file(key: str):
    _validate_key(key)
    metadata = get_file_metadata(key)
    if not metadata:
        raise HTTPException(status_code=404, detail="File not found")
    url = get_presigned_url(key, filename=metadata.filename)
    return {"url": url}


@router.get("/files/{key:path}", response_model=FileMetadata)
async def get_file(key: str):
    _validate_key(key)
    metadata = get_file_metadata(key)
    if not metadata:
        raise HTTPException(status_code=404, detail="File not found")
    return metadata


@router.delete("/files/{key:path}")
async def remove_file(key: str):
    _validate_key(key)
    success = delete_file(key)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete file")
    return {"deleted": True, "key": key}
