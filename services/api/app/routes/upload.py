import re
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, Request

from app.config import settings
from app.models import FileUploadResponse
from app.services.b2_s3 import upload_file, _humanize_bytes
from app.services.metadata import extract_metadata

router = APIRouter()

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/zip",
    "video/mp4",
    "audio/mpeg",
    "audio/wav",
    "image/svg+xml",
}

# Map MIME types to their valid file extensions
MIME_EXTENSION_MAP: dict[str, set[str]] = {
    "image/jpeg": {"jpg", "jpeg", "jfif"},
    "image/png": {"png"},
    "image/gif": {"gif"},
    "image/webp": {"webp"},
    "application/pdf": {"pdf"},
    "text/plain": {"txt", "text", "log", "md"},
    "text/csv": {"csv"},
    "application/json": {"json"},
    "application/zip": {"zip"},
    "video/mp4": {"mp4"},
    "audio/mpeg": {"mp3", "mpeg"},
    "audio/wav": {"wav"},
    "image/svg+xml": {"svg"},
}

# Strip anything that isn't alphanumeric, dash, underscore, or dot
_SAFE_FILENAME_RE = re.compile(r"[^\w\-.]")


def _sanitize_filename(filename: str) -> str:
    """Sanitize filename: strip path components, remove unsafe chars, limit length."""
    # Strip any path components (forward/back slashes)
    name = filename.replace("\\", "/").split("/")[-1]
    # Remove null bytes
    name = name.replace("\x00", "")
    # Replace unsafe characters
    name = _SAFE_FILENAME_RE.sub("_", name)
    # Collapse consecutive underscores/dots
    name = re.sub(r"[_.]{2,}", "_", name)
    # Strip leading dots (hidden files) and leading/trailing whitespace
    name = name.lstrip(".").strip()
    # Limit length
    if len(name) > 200:
        base, _, ext = name.rpartition(".")
        if ext:
            name = base[: 200 - len(ext) - 1] + "." + ext
        else:
            name = name[:200]
    return name or "unnamed"


def _validate_extension_matches_type(filename: str, content_type: str) -> bool:
    """Verify the file extension is consistent with the declared MIME type."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed_exts = MIME_EXTENSION_MAP.get(content_type)
    if allowed_exts is None:
        return False
    # If no extension, allow it (the content_type check is sufficient)
    if not ext:
        return True
    return ext in allowed_exts


@router.post("/upload", response_model=FileUploadResponse)
async def upload(request: Request, file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Check Content-Length header early to reject oversized uploads before reading body
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.max_file_size + 4096:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {_humanize_bytes(settings.max_file_size)}",
        )

    content_type = file.content_type or "application/octet-stream"

    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"File type '{content_type}' not allowed",
        )

    # Sanitize filename
    safe_name = _sanitize_filename(file.filename)

    # Validate extension matches declared content type
    if not _validate_extension_matches_type(safe_name, content_type):
        raise HTTPException(
            status_code=415,
            detail="File extension does not match declared content type",
        )

    # Read file with size limit enforcement (stream in chunks)
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)  # 1MB chunks
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size: {_humanize_bytes(settings.max_file_size)}",
            )
        chunks.append(chunk)
    file_data = b"".join(chunks)

    if len(file_data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    # Generate unique key under uploads/ prefix
    key = f"uploads/{uuid.uuid4().hex[:12]}_{safe_name}"

    result = upload_file(file_data, key, content_type)
    metadata = extract_metadata(file_data, safe_name, content_type)

    return FileUploadResponse(
        key=result.key,
        filename=result.filename,
        size_bytes=result.size_bytes,
        size_human=result.size_human,
        content_type=content_type,
        uploaded_at=result.uploaded_at,
        url=result.url,
        metadata=metadata,
    )
