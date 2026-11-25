import json
import logging
from datetime import UTC, datetime

from botocore.exceptions import ClientError

from app.config import settings
from app.config.intelligence import intel_settings
from app.repo.b2_client import get_s3_client
from app.types.classification import ClassificationResult
from app.types.cluster import Cluster, ClusterAssignment
from app.types.issue import SNAPSHOT_ID_RE, Issue, IssueMetadata, SnapshotStatus
from app.types.report import SnapshotReport

logger = logging.getLogger(__name__)

_PREFIX = intel_settings.snapshot_prefix
# Newest snapshots only: each listed snapshot costs one status read.
_MAX_LISTED_SNAPSHOTS = 50


def _put(key: str, body: str | bytes, content_type: str = "application/json") -> None:
    data = body.encode() if isinstance(body, str) else body
    get_s3_client().put_object(Bucket=settings.b2_bucket_name, Key=key, Body=data, ContentType=content_type)


def _get(key: str) -> bytes | None:
    try:
        resp = get_s3_client().get_object(Bucket=settings.b2_bucket_name, Key=key)
        return resp["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return None
        raise


def _checked(snap_id: str) -> str:
    """The id is part of a storage key, so it must be a minted timestamp id."""
    if not SNAPSHOT_ID_RE.fullmatch(snap_id):
        raise ValueError("Invalid snapshot id")
    return snap_id


def _raw_prefix(snap_id: str) -> str:
    return f"{_PREFIX}/raw/issues/snapshot={_checked(snap_id)}"


def _derived_prefix(snap_id: str, stage: str) -> str:
    return f"{_PREFIX}/derived/{stage}/snapshot={_checked(snap_id)}"


def _jsonl_lines(raw: bytes) -> list[str]:
    return [line for line in raw.decode().splitlines() if line.strip()]


def generate_snapshot_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def snapshot_exists(snapshot_id: str) -> bool:
    return (
        _get(f"{_raw_prefix(snapshot_id)}/issues.jsonl") is not None
        or _get(f"{_raw_prefix(snapshot_id)}/status.json") is not None
    )


def write_raw_snapshot(snapshot_id: str, issues: list[Issue], metadata: IssueMetadata) -> None:
    prefix = _raw_prefix(snapshot_id)
    _put(f"{prefix}/issues.jsonl", "\n".join(i.model_dump_json() for i in issues), "application/jsonl")
    _put(f"{prefix}/metadata.json", metadata.model_dump_json())
    logger.info("Wrote raw snapshot %s (%d issues)", snapshot_id, len(issues))


def read_raw_snapshot(snapshot_id: str) -> tuple[list[Issue], IssueMetadata]:
    prefix = _raw_prefix(snapshot_id)
    raw = _get(f"{prefix}/issues.jsonl")
    if raw is None:
        raise FileNotFoundError(f"Snapshot {snapshot_id} not found")
    issues = [Issue.model_validate_json(line) for line in _jsonl_lines(raw)]
    meta_raw = _get(f"{prefix}/metadata.json")
    metadata = IssueMetadata.model_validate_json(meta_raw) if meta_raw else IssueMetadata(
        repo="unknown", fetched_at=datetime.now(UTC), total_count=len(issues)
    )
    return issues, metadata


def write_embeddings(snapshot_id: str, records: list[dict]) -> None:
    key = f"{_derived_prefix(snapshot_id, 'embeddings')}/embeddings.jsonl"
    _put(key, "\n".join(json.dumps(r) for r in records), "application/jsonl")


def read_embeddings(snapshot_id: str) -> list[dict]:
    raw = _get(f"{_derived_prefix(snapshot_id, 'embeddings')}/embeddings.jsonl")
    return [json.loads(line) for line in _jsonl_lines(raw)] if raw else []


def write_classifications(snapshot_id: str, results: list[ClassificationResult]) -> None:
    key = f"{_derived_prefix(snapshot_id, 'classifications')}/classified.jsonl"
    _put(key, "\n".join(r.model_dump_json() for r in results), "application/jsonl")


def read_classifications(snapshot_id: str) -> list[ClassificationResult]:
    raw = _get(f"{_derived_prefix(snapshot_id, 'classifications')}/classified.jsonl")
    return [ClassificationResult.model_validate_json(line) for line in _jsonl_lines(raw)] if raw else []


def write_clusters(
    snapshot_id: str, clusters: list[Cluster], assignments: list[ClusterAssignment]
) -> None:
    prefix = _derived_prefix(snapshot_id, "clusters")
    _put(f"{prefix}/clusters.json", json.dumps([c.model_dump() for c in clusters]))
    _put(f"{prefix}/assignments.jsonl", "\n".join(a.model_dump_json() for a in assignments), "application/jsonl")


def read_clusters(snapshot_id: str) -> tuple[list[Cluster], list[ClusterAssignment]]:
    prefix = _derived_prefix(snapshot_id, "clusters")
    clusters_raw = _get(f"{prefix}/clusters.json")
    clusters = [Cluster.model_validate(c) for c in json.loads(clusters_raw or "[]")]
    assignments_raw = _get(f"{prefix}/assignments.jsonl")
    assignments = (
        [ClusterAssignment.model_validate_json(line) for line in _jsonl_lines(assignments_raw)]
        if assignments_raw
        else []
    )
    return clusters, assignments


def write_report(snapshot_id: str, report: SnapshotReport) -> None:
    _put(f"{_derived_prefix(snapshot_id, 'reports')}/report.json", report.model_dump_json())


def read_report(snapshot_id: str) -> SnapshotReport | None:
    raw = _get(f"{_derived_prefix(snapshot_id, 'reports')}/report.json")
    return SnapshotReport.model_validate_json(raw) if raw else None


def write_snapshot_status(snapshot_id: str, status: SnapshotStatus) -> None:
    _put(f"{_raw_prefix(snapshot_id)}/status.json", status.model_dump_json())


def read_snapshot_status(snapshot_id: str) -> SnapshotStatus | None:
    raw = _get(f"{_raw_prefix(snapshot_id)}/status.json")
    return SnapshotStatus.model_validate_json(raw) if raw else None


def _status_for(snap_prefix: str, snap_id: str) -> SnapshotStatus:
    raw = _get(f"{snap_prefix}status.json")
    if raw:
        try:
            return SnapshotStatus.model_validate_json(raw)
        except ValueError:
            logger.warning("Unreadable status.json for snapshot %s", snap_id)
    meta_raw = _get(f"{snap_prefix}metadata.json")
    if meta_raw:
        try:
            meta = IssueMetadata.model_validate_json(meta_raw)
            return SnapshotStatus(
                snapshot_id=snap_id, repo=meta.repo, fetched_at=meta.fetched_at,
                status="complete", total_issues=meta.total_count,
            )
        except ValueError:
            logger.warning("Unreadable metadata.json for snapshot %s", snap_id)
    return SnapshotStatus(snapshot_id=snap_id, repo="unknown", fetched_at=datetime.now(UTC), status="unknown")


def list_snapshots() -> list[SnapshotStatus]:
    """The newest snapshots, newest first. Raises RuntimeError on B2 failure."""
    prefix = f"{_PREFIX}/raw/issues/"
    kwargs: dict = {"Bucket": settings.b2_bucket_name, "Prefix": prefix, "Delimiter": "/"}
    prefixes: list[str] = []
    try:
        while True:
            resp = get_s3_client().list_objects_v2(**kwargs)
            prefixes.extend(cp["Prefix"] for cp in resp.get("CommonPrefixes", []))
            if not resp.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = resp["NextContinuationToken"]
    except ClientError as e:
        raise RuntimeError(f"B2 list snapshots failed: {e}") from e
    results = []
    for snap_prefix in sorted(prefixes, reverse=True)[:_MAX_LISTED_SNAPSHOTS]:
        snap_id = snap_prefix.rstrip("/").split("snapshot=")[-1]
        if SNAPSHOT_ID_RE.fullmatch(snap_id):
            results.append(_status_for(snap_prefix, snap_id))
    results.sort(key=lambda s: s.snapshot_id, reverse=True)
    return results
