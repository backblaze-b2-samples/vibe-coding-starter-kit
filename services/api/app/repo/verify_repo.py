import json
import logging
import time
from threading import Lock

from botocore.exceptions import ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client
from app.types.verify import RUN_ID_RE

logger = logging.getLogger(__name__)

_PREFIX = "verification-runs/"

# Only the newest runs are read: each one costs a `get_object` for its summary.
MAX_RUNS = 50
# The run list is cached briefly so a dashboard refresh (or a few viewers) does
# not turn into one B2 read per run per request.
_LIST_TTL_SECONDS = 30.0
# Presigned artifact links: 10 minutes, the same lifetime as file downloads
# (see docs/SECURITY.md).
_ARTIFACT_URL_EXPIRY_SECONDS = 600

_cache_lock = Lock()
_cache: tuple[float, list[dict]] | None = None


def _reset_cache() -> None:
    """Drop the cached run list (tests)."""
    global _cache
    with _cache_lock:
        _cache = None


def _list_run_prefixes(client) -> list[str]:
    """Every `verification-runs/<run_id>/` prefix, following continuation tokens."""
    prefixes: list[str] = []
    kwargs: dict = {
        "Bucket": settings.b2_bucket_name,
        "Prefix": _PREFIX,
        "Delimiter": "/",
    }
    while True:
        response = client.list_objects_v2(**kwargs)
        prefixes.extend(entry["Prefix"] for entry in response.get("CommonPrefixes", []))
        if not response.get("IsTruncated"):
            return prefixes
        kwargs["ContinuationToken"] = response["NextContinuationToken"]


def list_runs() -> list[dict]:
    """Verification runs, newest first (at most `MAX_RUNS`).

    Run ids start with their date, so sorting the prefixes picks the newest
    runs without reading any summary. Their summaries are then fetched once and
    the result is cached for a short time. Malformed or missing summaries are
    skipped. Raises RuntimeError on B2 failure.
    """
    global _cache
    now = time.monotonic()
    with _cache_lock:
        if _cache is not None and now - _cache[0] < _LIST_TTL_SECONDS:
            return list(_cache[1])

    client = get_s3_client()
    try:
        prefixes = _list_run_prefixes(client)
    except ClientError as e:
        raise RuntimeError(f"B2 list_runs failed: {e}") from e

    runs: list[dict] = []
    for run_prefix in sorted(prefixes, reverse=True)[:MAX_RUNS]:
        summary_key = f"{run_prefix}summary.json"
        try:
            obj = client.get_object(Bucket=settings.b2_bucket_name, Key=summary_key)
            runs.append(json.loads(obj["Body"].read()))
        except ClientError:
            logger.warning("Missing or unreadable summary.json at %s", summary_key)
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Malformed summary.json at %s: %s", summary_key, e)

    runs.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
    with _cache_lock:
        _cache = (time.monotonic(), runs)
    return list(runs)


def get_run(run_id: str) -> dict | None:
    """Full run detail with presigned artifact URLs, or None if the run is absent.

    Raises ValueError for an id that is not a valid run id, before any key is
    built, and RuntimeError on B2 failure.
    """
    if not RUN_ID_RE.fullmatch(run_id):
        raise ValueError("Invalid run id")
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
    except (ClientError, json.JSONDecodeError):
        results = {}

    return {
        **summary,
        "results": results,
        "screenshot_urls": _presign_prefix(f"{run_prefix}screenshots/"),
        "trace_urls": _presign_prefix(f"{run_prefix}traces/"),
    }


def _presign_prefix(prefix: str) -> list[str]:
    """Presigned GET URLs (10 minutes) for every object under `prefix`, all pages."""
    client = get_s3_client()
    urls: list[str] = []
    kwargs: dict = {"Bucket": settings.b2_bucket_name, "Prefix": prefix}
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for obj in response.get("Contents", []):
                try:
                    urls.append(
                        client.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": settings.b2_bucket_name, "Key": obj["Key"]},
                            ExpiresIn=_ARTIFACT_URL_EXPIRY_SECONDS,
                        )
                    )
                except ClientError as e:
                    logger.warning("Failed to presign %s: %s", obj["Key"], e)
            if not response.get("IsTruncated"):
                return urls
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except ClientError:
        return urls
