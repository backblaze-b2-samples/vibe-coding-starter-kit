from datetime import datetime

from pydantic import BaseModel, Field

from app.types.base import ResponseModel
from app.types.files import FileMetadataDetail


class FileUploadResponse(ResponseModel):
    """The stored object as `POST /upload/verify` reports it back."""

    key: str
    filename: str
    size_bytes: int
    size_human: str
    content_type: str
    uploaded_at: datetime
    url: str | None = Field(
        default=None,
        description="Public object URL when the bucket is public, else null.",
    )
    metadata: FileMetadataDetail | None = Field(
        default=None,
        description="Rich metadata, when extraction succeeded for this type.",
    )


class PresignUploadRequest(BaseModel):
    """What the browser declares before uploading directly to B2."""

    filename: str
    content_type: str
    size_bytes: int


class PresignUploadResponse(ResponseModel):
    """A short-lived presigned PUT the browser uploads to, plus the exact
    headers it must send. `Content-Length` and `content-type` are signed into
    the URL, so B2 rejects a body of any other size or type.
    """

    key: str
    url: str
    method: str
    content_type: str
    headers: dict[str, str] = Field(
        description=(
            "Signed into the URL, so the browser must send them verbatim — B2 "
            "answers a mismatch with 403."
        )
    )
    expires_in: int


class VerifyUploadRequest(BaseModel):
    """Sent after the direct PUT so the API can inspect the stored object."""

    key: str
