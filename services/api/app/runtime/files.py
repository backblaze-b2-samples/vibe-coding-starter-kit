import logging

from fastapi import APIRouter, HTTPException

from app.service.files import (
    FileKeyError,
    FileNotFoundError,
    get_download_url,
    get_file,
    get_files,
    get_stats,
    remove_file,
)
from app.types import FileMetadata, UploadStats

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/files", response_model=list[FileMetadata])
async def list_files_endpoint(prefix: str = "", limit: int = 100):
    try:
        return get_files(prefix=prefix, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/files/stats", response_model=UploadStats)
async def stats_endpoint():
    return get_stats()


@router.get("/files/{key:path}/download")
async def download_file_endpoint(key: str):
    try:
        url = get_download_url(key)
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
    return {"url": url}


@router.get("/files/{key:path}", response_model=FileMetadata)
async def get_file_endpoint(key: str):
    try:
        return get_file(key)
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None


@router.delete("/files/{key:path}")
async def delete_file_endpoint(key: str):
    try:
        remove_file(key)
    except FileKeyError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Failed to delete file") from None
    logger.info("File deleted: key=%s", key)
    return {"deleted": True, "key": key}
