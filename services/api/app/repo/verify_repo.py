import json
import logging

from botocore.exceptions import ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client

logger = logging.getLogger(__name__)

_PREFIX = "verification-runs/"


def list_runs() -> list[dict]:
    """List verification runs from B2, sorted newest-first.

    Uses list_objects_v2 with a delimiter to find run prefixes, then
    fetches summary.json for each. Skips malformed or missing summaries.
    """
    client = get_s3_client()
    try:
        response = client.list_objects_v2(
            Bucket=settings.b2_bucket_name,
            Prefix=_PREFIX,
            Delimiter="/",
        )
    except ClientError as e:
        raise RuntimeError(f"B2 list_runs failed: {e}") from e

    runs: list[dict] = []
    for prefix_entry in response.get("CommonPrefixes", []):
        run_prefix = prefix_entry["Prefix"]
        summary_key = f"{run_prefix}summary.json"
        try:
            obj = client.get_object(Bucket=settings.b2_bucket_name, Key=summary_key)
            data = json.loads(obj["Body"].read())
            runs.append(data)
        except ClientError:
            logger.warning("Missing or unreadable summary.json at %s", summary_key)
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Malformed summary.json at %s: %s", summary_key, e)

    runs.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    return runs


def get_run(run_id: str) -> dict | None:
    """Fetch full run detail including presigned URLs for screenshots and traces."""
    client = get_s3_client()
    run_prefix = f"{_PREFIX}{run_id}/"
    summary_key = f"{run_prefix}summary.json"
    results_key = f"{run_prefix}results.json"

    try:
        summary_obj = client.get_object(Bucket=settings.b2_bucket_name, Key=summary_key)
        summary = json.loads(summary_obj["Body"].read())
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 get_run summary failed for '{run_id}': {e}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Malformed summary.json for '{run_id}': {e}") from e

    try:
        results_obj = client.get_object(Bucket=settings.b2_bucket_name, Key=results_key)
        results = json.loads(results_obj["Body"].read())
    except ClientError:
        results = {}

    screenshot_urls = _presign_prefix(f"{run_prefix}screenshots/")
    trace_urls = _presign_prefix(f"{run_prefix}traces/")

    return {**summary, "results": results, "screenshot_urls": screenshot_urls, "trace_urls": trace_urls}


def _presign_prefix(prefix: str) -> list[str]:
    """List all objects under prefix and return presigned GET URLs (3600s)."""
    client = get_s3_client()
    try:
        response = client.list_objects_v2(Bucket=settings.b2_bucket_name, Prefix=prefix)
    except ClientError:
        return []

    urls: list[str] = []
    for obj in response.get("Contents", []):
        try:
            url = client.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.b2_bucket_name, "Key": obj["Key"]},
                ExpiresIn=3600,
            )
            urls.append(url)
        except ClientError as e:
            logger.warning("Failed to presign %s: %s", obj["Key"], e)
    return urls
