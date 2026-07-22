"""On-demand object body reads.

Kept in its own module because `b2_client.py` is at the 300-line ceiling
enforced by `tests/test_structure.py`. boto3/botocore stays confined to the
repo/ layer; the cached S3 client is reused from `b2_client` for connection
pooling.
"""

from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client


def get_object_bytes(key: str) -> bytes:
    """Download an object's full body into memory.

    Buffers the whole object, so callers MUST size-guard before calling (see
    `service.files.get_file_detail`). Raises RuntimeError on any S3 failure,
    including a not-found object — callers that need to distinguish "missing"
    should `head` first via `get_file_metadata`.

    The streaming `.read()` stays inside the try: on a large object it can fail
    mid-stream with a BotoCoreError (e.g. ReadTimeoutError, ResponseStreamingError)
    that is not a ClientError, and letting it escape would break the
    RuntimeError contract the caller's 502 mapping relies on.
    """
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
        return response["Body"].read()
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 get_object failed for '{key}': {e}") from e
