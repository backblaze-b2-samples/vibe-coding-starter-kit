"""Direct-to-B2 upload helpers: presigned PUT + post-upload inspection.

Split out of ``b2_client`` to keep that module under the 300-line ceiling. Same
``repo`` layer, so boto3/botocore usage is allowed here too.
"""

from botocore.exceptions import ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client
from app.repo.list_cache import invalidate as _invalidate_list_cache


def generate_presigned_upload(
    key: str,
    content_type: str,
    content_length: int,
    expires_in: int = 900,
) -> str:
    """Presigned PUT URL for a direct browser-to-B2 upload.

    ``Content-Length`` and ``Content-Type`` are signed into the URL, so B2
    refuses a body of any other size (``403 SignatureDoesNotMatch``) or type.
    That is how the direct path keeps the size/type enforcement the old proxy
    did in-process — B2's S3 API has no browser POST-policy
    (``content-length-range``) support. Raises RuntimeError on S3 failure.
    """
    client = get_s3_client()
    try:
        return client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.b2_bucket_name,
                "Key": key,
                "ContentType": content_type,
                "ContentLength": content_length,
            },
            ExpiresIn=expires_in,
        )
    except ClientError as e:
        raise RuntimeError(f"B2 presign (PUT) failed for '{key}': {e}") from e


def get_object_head_bytes(key: str, length: int) -> bytes | None:
    """Fetch the first ``length`` bytes of an object via a Range GET.

    Cheap magic-byte sniff for a direct upload we never streamed: it pulls only
    the header, not the whole object. Returns None if the object is missing.
    Raises RuntimeError on other S3 failures.
    """
    client = get_s3_client()
    try:
        response = client.get_object(
            Bucket=settings.b2_bucket_name,
            Key=key,
            Range=f"bytes=0-{max(length - 1, 0)}",
        )
        return response["Body"].read()
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 range-get failed for '{key}': {e}") from e


def invalidate_listing() -> None:
    """Drop the shared listing cache.

    The direct-upload path stores the object via the browser, so the app never
    calls ``upload_file`` and nothing else invalidates the cache — the new
    object would otherwise not appear in ``/files`` or ``/files/stats`` until
    the TTL.
    """
    _invalidate_list_cache()
