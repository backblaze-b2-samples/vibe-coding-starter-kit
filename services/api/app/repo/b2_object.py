"""On-demand object body reads.

Kept in its own module because `b2_client.py` is at the 300-line ceiling
enforced by `tests/test_structure.py`. boto3/botocore stays confined to the
repo/ layer; the cached S3 client is reused from `b2_client` for connection
pooling.
"""

from botocore.exceptions import ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client


def get_object_bytes(key: str) -> bytes:
    """Download an object's full body into memory.

    Buffers the whole object, so callers MUST size-guard before calling (see
    `service.files.get_file_detail`). Raises RuntimeError on any S3 failure,
    including a not-found object — callers that need to distinguish "missing"
    should `head` first via `get_file_metadata`.
    """
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
    except ClientError as e:
        raise RuntimeError(f"B2 get_object failed for '{key}': {e}") from e
    return response["Body"].read()
