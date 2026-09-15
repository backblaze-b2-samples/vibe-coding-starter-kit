from datetime import datetime

from pydantic import Field

from app.types.base import ResponseModel


class FileMetadata(ResponseModel):
    """One stored object as the file list and the by-key metadata route see it."""

    key: str
    filename: str
    folder: str
    size_bytes: int
    size_human: str
    content_type: str
    uploaded_at: datetime
    url: str | None = Field(
        default=None,
        description=(
            "Public object URL, set only when B2_PUBLIC_URL_BASE is configured "
            "and the bucket is public. Null otherwise — the UI asks for a "
            "presigned URL instead."
        ),
    )


class FileMetadataDetail(ResponseModel):
    """Rich metadata recomputed on demand by re-reading the stored object."""

    filename: str
    size_bytes: int
    size_human: str
    mime_type: str
    extension: str
    md5: str
    sha256: str
    uploaded_at: datetime
    metadata_warning: str | None = Field(
        default=None,
        description=(
            "Set when a format-specific extractor was skipped or failed (e.g. "
            "an image above Pillow's decompression-bomb limit). The core "
            "fields are always exact, so the UI shows this instead of "
            "silently dropping the Image / PDF section."
        ),
    )
    image_width: int | None = Field(
        default=None, description="Image-specific: pixel width. Null for non-images."
    )
    image_height: int | None = Field(
        default=None, description="Image-specific: pixel height. Null for non-images."
    )
    exif: dict[str, str] | None = Field(
        default=None,
        description=(
            "Image-specific: EXIF tags, values stringified. Null for "
            "non-images or when no EXIF block was present."
        ),
    )
    pdf_pages: int | None = Field(
        default=None, description="PDF-specific: page count. Null for non-PDFs."
    )
    pdf_author: str | None = Field(default=None, description="PDF-specific: author.")
    pdf_title: str | None = Field(default=None, description="PDF-specific: title.")
    duration_seconds: float | None = Field(
        default=None, description="Audio/video: duration in seconds."
    )
    codec: str | None = Field(default=None, description="Audio/video: codec name.")
    bitrate: int | None = Field(default=None, description="Audio/video: bits per second.")


class FileUrlResponse(ResponseModel):
    """A short-lived presigned GET for downloading or previewing one object."""

    url: str = Field(
        description=(
            "Presigned GET URL. Download URLs force an attachment "
            "disposition; preview URLs are signed inline so a PDF renders in "
            "place."
        )
    )


class DeleteFileResponse(ResponseModel):
    """Acknowledgement that one object was removed from the bucket."""

    deleted: bool
    key: str
