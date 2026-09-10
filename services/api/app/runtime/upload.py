import logging

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.runtime.metrics import record_upload
from app.service.upload import UploadError, create_presigned_upload, verify_upload
from app.types import (
    FileUploadResponse,
    PresignUploadRequest,
    PresignUploadResponse,
    VerifyUploadRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload/presign", response_model=PresignUploadResponse)
async def presign_upload(req: PresignUploadRequest):
    """Validate a declared upload and hand back a presigned PUT.

    The browser uploads the bytes straight to B2 with the returned URL, so they
    never traverse this Function — that is what lifts Vercel's ~4.5 MB payload
    ceiling. Size and content-type are signed into the URL (see the service).
    """
    try:
        # generate_presigned_url does blocking (botocore) work; keep it off the
        # event loop.
        return await run_in_threadpool(
            create_presigned_upload,
            filename=req.filename,
            content_type=req.content_type,
            size_bytes=req.size_bytes,
        )
    except UploadError as e:
        logger.warning("Presign rejected: %s", e.detail)
        record_upload(success=False)
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None


@router.post("/upload/verify", response_model=FileUploadResponse)
async def verify_upload_route(req: VerifyUploadRequest):
    """Confirm an object just uploaded directly to B2 is valid and visible."""
    try:
        result = await run_in_threadpool(verify_upload, req.key)
    except UploadError as e:
        logger.warning("Upload verification rejected: %s", e.detail)
        record_upload(success=False)
        raise HTTPException(status_code=e.status_code, detail=e.detail) from None

    record_upload(success=True)
    logger.info(
        "File uploaded (direct): key=%s size=%d type=%s",
        result.key,
        result.size_bytes,
        result.content_type,
    )
    return result
