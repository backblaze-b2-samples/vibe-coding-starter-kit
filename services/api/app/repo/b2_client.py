import io
import mimetypes
from datetime import datetime

import boto3
from botocore.config import Config

from app.config import settings
from app.types import FileMetadata


def _humanize_bytes(size: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(size) < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024  # type: ignore[assignment]
    return f"{size:.1f} PB"


def _guess_content_type(key: str) -> str:
    mime, _ = mimetypes.guess_type(key)
    return mime or "application/octet-stream"


def _split_key(key: str) -> tuple[str, str]:
    """Return (folder, filename) from an object key."""
    parts = key.rsplit("/", 1)
    if len(parts) == 2:
        return parts[0] + "/", parts[1]
    return "", parts[0]


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.b2_s3_endpoint,
        aws_access_key_id=settings.b2_application_key_id,
        aws_secret_access_key=settings.b2_application_key,
        config=Config(
            signature_version="s3v4",
            user_agent_extra="b2ai-oss-start",
        ),
    )


def check_connectivity() -> bool:
    try:
        client = get_s3_client()
        client.head_bucket(Bucket=settings.b2_bucket_name)
        return True
    except Exception:
        return False


def upload_file(
    file_data: bytes, key: str, content_type: str
) -> FileMetadata:
    client = get_s3_client()
    client.put_object(
        Bucket=settings.b2_bucket_name,
        Key=key,
        Body=io.BytesIO(file_data),
        ContentType=content_type,
    )
    url = None
    if settings.b2_public_url:
        url = f"{settings.b2_public_url}/{key}"

    folder, filename = _split_key(key)
    size = len(file_data)
    return FileMetadata(
        key=key,
        filename=filename,
        folder=folder,
        size_bytes=size,
        size_human=_humanize_bytes(size),
        content_type=content_type,
        uploaded_at=datetime.utcnow(),
        url=url,
    )


def list_files(prefix: str = "", max_keys: int = 1000) -> list[FileMetadata]:
    client = get_s3_client()
    response = client.list_objects_v2(
        Bucket=settings.b2_bucket_name,
        Prefix=prefix,
        MaxKeys=max_keys,
    )
    files: list[FileMetadata] = []
    for obj in response.get("Contents", []):
        url = None
        if settings.b2_public_url:
            url = f"{settings.b2_public_url}/{obj['Key']}"
        folder, filename = _split_key(obj["Key"])
        files.append(
            FileMetadata(
                key=obj["Key"],
                filename=filename,
                folder=folder,
                size_bytes=obj["Size"],
                size_human=_humanize_bytes(obj["Size"]),
                content_type=_guess_content_type(obj["Key"]),
                uploaded_at=obj["LastModified"],
                url=url,
            )
        )
    files.sort(key=lambda f: f.uploaded_at, reverse=True)
    return files


def get_file_metadata(key: str) -> FileMetadata | None:
    client = get_s3_client()
    try:
        response = client.head_object(
            Bucket=settings.b2_bucket_name, Key=key
        )
    except client.exceptions.ClientError:
        return None

    url = None
    if settings.b2_public_url:
        url = f"{settings.b2_public_url}/{key}"

    folder, filename = _split_key(key)
    return FileMetadata(
        key=key,
        filename=filename,
        folder=folder,
        size_bytes=response["ContentLength"],
        size_human=_humanize_bytes(response["ContentLength"]),
        content_type=response.get("ContentType", _guess_content_type(key)),
        uploaded_at=response["LastModified"],
        url=url,
    )


def delete_file(key: str) -> bool:
    client = get_s3_client()
    try:
        client.delete_object(Bucket=settings.b2_bucket_name, Key=key)
        return True
    except Exception:
        return False


def get_presigned_url(
    key: str, filename: str | None = None, expires_in: int = 600
) -> str:
    client = get_s3_client()
    params: dict = {"Bucket": settings.b2_bucket_name, "Key": key}
    if filename:
        params["ResponseContentDisposition"] = (
            f'attachment; filename="{filename}"'
        )
    else:
        params["ResponseContentDisposition"] = "attachment"
    return client.generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=expires_in,
    )


def get_upload_stats() -> dict:
    client = get_s3_client()
    response = client.list_objects_v2(
        Bucket=settings.b2_bucket_name, MaxKeys=10000
    )
    contents = response.get("Contents", [])
    total_size = sum(obj["Size"] for obj in contents)
    today = datetime.utcnow().date()
    uploads_today = sum(
        1 for obj in contents if obj["LastModified"].date() == today
    )
    return {
        "total_files": len(contents),
        "total_size_bytes": total_size,
        "total_size_human": _humanize_bytes(total_size),
        "uploads_today": uploads_today,
    }
