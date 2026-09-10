import re
from collections.abc import Callable
from typing import NoReturn

from app.config import settings
from app.repo import (
    delete_file,
    generate_presigned_upload,
    get_file_metadata,
    get_object_head_bytes,
    invalidate_listing,
)
from app.service.files import FileKeyError, validate_key
from app.types import FileUploadResponse, PresignUploadResponse
from app.types.formatting import humanize_bytes

# Note: image/svg+xml is deliberately excluded. SVGs can embed <script>, so a
# file stored and later served from a public bucket URL would execute in the
# browser (stored XSS). Re-add only with server-side SVG sanitization.
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
    # Text / data formats common in the sample apps built on this kit
    # (markdown docs, configs, datasets, tabular/structured exports).
    "text/markdown",
    "application/yaml",
    "application/x-yaml",
    "application/x-ndjson",
    "text/tab-separated-values",
    "application/xml",
    "text/xml",
    # Office documents (OOXML) for document-ingestion / RAG samples.
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Additional video containers (mp4 already above).
    "video/quicktime",
    "video/webm",
}

_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

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
    "text/markdown": {"md", "markdown"},
    "application/yaml": {"yaml", "yml"},
    "application/x-yaml": {"yaml", "yml"},
    "application/x-ndjson": {"jsonl", "ndjson"},
    "text/tab-separated-values": {"tsv"},
    "application/xml": {"xml"},
    "text/xml": {"xml"},
    _DOCX: {"docx"},
    _XLSX: {"xlsx"},
    _PPTX: {"pptx"},
    "video/quicktime": {"mov"},
    "video/webm": {"webm"},
}

# Magic-byte signatures for the binary types we accept. The client-declared
# content_type is untrusted, so we sniff the leading bytes and reject obvious
# mismatches (e.g. an HTML/script payload uploaded as image/png). Text-like
# types (text/plain, text/csv, application/json) and the OOXML/container types
# have no reliable leading signature and are intentionally absent — they skip
# this check but remain constrained by the extension/type consistency check.
# This dict is the single source of truth for BOTH the check and
# `content_type_has_signature()`, so the verify path never fetches header bytes
# for a type it wouldn't inspect.
_CONTENT_SIGNATURES: dict[str, Callable[[bytes], bool]] = {
    "image/jpeg": lambda d: d[:3] == b"\xff\xd8\xff",
    "image/png": lambda d: d[:8] == b"\x89PNG\r\n\x1a\n",
    "image/gif": lambda d: d[:6] in (b"GIF87a", b"GIF89a"),
    "image/webp": lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP",
    "application/pdf": lambda d: d[:5] == b"%PDF-",
    "application/zip": lambda d: d[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "video/mp4": lambda d: d[4:8] == b"ftyp",  # ISO base media 'ftyp' box
    # ID3 tag, or an MPEG audio frame sync (11 set bits).
    "audio/mpeg": lambda d: d[:3] == b"ID3"
    or (len(d) >= 2 and d[0] == 0xFF and (d[1] & 0xE0) == 0xE0),
    "audio/wav": lambda d: d[:4] == b"RIFF" and d[8:12] == b"WAVE",
}


def content_type_has_signature(content_type: str) -> bool:
    """True if `content_type` has a magic-byte signature worth sniffing."""
    return content_type in _CONTENT_SIGNATURES


def matches_content_signature(data: bytes, content_type: str) -> bool:
    """Return True if `data`'s leading bytes are consistent with `content_type`.

    Types without a known signature return True (nothing to verify).
    """
    check = _CONTENT_SIGNATURES.get(content_type)
    return check(data) if check else True


_SAFE_FILENAME_RE = re.compile(r"[^\w\-.]")


def sanitize_filename(filename: str) -> str:
    """Sanitize filename: strip path components, remove unsafe chars, limit length."""
    name = filename.replace("\\", "/").split("/")[-1]
    name = name.replace("\x00", "")
    name = _SAFE_FILENAME_RE.sub("_", name)
    name = re.sub(r"[_.]{2,}", "_", name)
    name = name.lstrip(".").strip()
    if len(name) > 200:
        base, sep, ext = name.rpartition(".")
        # Preserve the extension only when there is one that still fits;
        # otherwise (no dot, or an absurdly long "extension") hard-truncate.
        # `rpartition` returns ("", "", name) when there is no dot, so guard on
        # `sep`, not `ext` — else an extensionless name keeps its whole body.
        name = (
            base[: 200 - len(ext) - 1] + "." + ext
            if sep and len(ext) < 200
            else name[:200]
        )
    return name or "unnamed"


def validate_extension_matches_type(filename: str, content_type: str) -> bool:
    """Verify the file extension is consistent with the declared MIME type."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    allowed_exts = MIME_EXTENSION_MAP.get(content_type)
    if allowed_exts is None:
        return False
    if not ext:
        return True
    return ext in allowed_exts


class UploadError(Exception):
    """Raised when upload validation fails."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


# Every object the app writes lives under this prefix; the API mints the key so
# the client never chooses where its bytes land.
UPLOAD_PREFIX = "uploads/"
# Leading bytes fetched for the post-upload sniff. The deepest signature check
# reads data[8:12]; 512 leaves generous headroom for any future signature.
_SNIFF_BYTES = 512


def _validate_declared(filename: str, content_type: str, size_bytes: int) -> str:
    """Validate a *declared* upload (pre-bytes) and return the key it may write.

    Runs at presign time and applies the same allow-list / extension / size
    rules the old proxy applied to the bytes. Raises UploadError on failure.
    """
    if not filename:
        raise UploadError("No filename provided")
    if size_bytes <= 0:
        raise UploadError("Empty file")
    if size_bytes > settings.max_file_size:
        raise UploadError(
            f"File too large. Max size: {humanize_bytes(settings.max_file_size)}",
            status_code=413,
        )
    if content_type not in ALLOWED_TYPES:
        raise UploadError(
            f"File type '{content_type}' not allowed", status_code=415
        )
    safe_name = sanitize_filename(filename)
    if not validate_extension_matches_type(safe_name, content_type):
        raise UploadError(
            "File extension does not match declared content type",
            status_code=415,
        )
    return f"{UPLOAD_PREFIX}{safe_name}"


def create_presigned_upload(
    filename: str, content_type: str, size_bytes: int
) -> PresignUploadResponse:
    """Validate a declared upload and return a presigned PUT for direct-to-B2.

    `size_bytes` and `content_type` are signed into the URL, so B2 refuses any
    body of a different size or type — the size/type guarantees survive even
    though the bytes never reach the API. Raises UploadError on failure.
    """
    key = _validate_declared(filename, content_type, size_bytes)
    expires_in = settings.presign_upload_expiry_seconds
    url = generate_presigned_upload(key, content_type, size_bytes, expires_in)
    return PresignUploadResponse(
        key=key,
        url=url,
        method="PUT",
        content_type=content_type,
        # The browser MUST send exactly these — they are signed into the URL.
        headers={"Content-Type": content_type},
        expires_in=expires_in,
    )


def verify_upload(key: str) -> FileUploadResponse:
    """Inspect an object just uploaded directly to B2 and confirm it is valid.

    A HEAD covers size/type; a Range-GET of the leading bytes recovers the
    magic-byte sniff without downloading the object. Anything that fails is
    deleted. Rich metadata is intentionally not recomputed here (it would mean
    downloading the whole object); it stays available via `/files-by-key/detail`.
    Raises UploadError on any failure.

    NOTE: the browser is trusted to call this. A client that PUTs and never
    calls verify leaves the object in place; the periodic bucket scan will then
    list it. The unconditional controls that do NOT depend on verify are the
    presign allow-list (no HTML/SVG), the signed content-type (the object is
    always served as an allow-listed, non-executable type) and the signed size.
    Enabling quarantine→promote (see the design plan) closes that window.
    """
    if not key.startswith(UPLOAD_PREFIX):
        raise UploadError("Upload key must be under the uploads/ prefix")
    try:
        validate_key(key)
    except FileKeyError as e:
        raise UploadError(e.detail) from None

    metadata = get_file_metadata(key)  # HEAD
    if not metadata:
        raise UploadError("Uploaded object not found", status_code=404)

    def _reject(detail: str, status_code: int) -> NoReturn:
        # The object exists but is invalid, so remove it before failing.
        delete_file(key)
        raise UploadError(detail, status_code=status_code)

    if metadata.size_bytes == 0:
        _reject("Empty file", 400)
    if metadata.size_bytes > settings.max_file_size:
        _reject(
            f"File too large. Max size: {humanize_bytes(settings.max_file_size)}",
            413,
        )
    if metadata.content_type not in ALLOWED_TYPES:
        _reject(f"File type '{metadata.content_type}' not allowed", 415)
    if not validate_extension_matches_type(metadata.filename, metadata.content_type):
        _reject("File extension does not match declared content type", 415)

    # Only fetch header bytes for types that actually have a signature — text
    # and container types would just pass unconditionally, so the Range-GET is
    # pure waste on the (common) data-file upload path.
    if content_type_has_signature(metadata.content_type):
        head = get_object_head_bytes(key, _SNIFF_BYTES)
        if head is None:
            raise UploadError("Uploaded object not found", status_code=404)
        if not matches_content_signature(head, metadata.content_type):
            _reject("File contents do not match the declared type", 415)

    # The browser stored the object, so the shared listing cache is now stale.
    invalidate_listing()
    return FileUploadResponse(
        key=metadata.key,
        filename=metadata.filename,
        size_bytes=metadata.size_bytes,
        size_human=metadata.size_human,
        content_type=metadata.content_type,
        uploaded_at=metadata.uploaded_at,
        url=metadata.url,
        metadata=None,
    )
