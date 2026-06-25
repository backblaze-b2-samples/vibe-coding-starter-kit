import io
import json
import logging
from datetime import UTC, datetime

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import settings
from app.config.intelligence import intel_settings
from app.types.classification import ClassificationResult
from app.types.cluster import Cluster, ClusterAssignment
from app.types.issue import Issue, IssueMetadata, SnapshotStatus
from app.types.report import SnapshotReport

logger = logging.getLogger(__name__)

_PREFIX = intel_settings.snapshot_prefix


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.b2_endpoint,
        aws_access_key_id=settings.b2_key_id,
        aws_secret_access_key=settings.b2_application_key,
        config=Config(signature_version="s3v4"),
    )


def _put(key: str, body: str | bytes, content_type: str = "application/json") -> None:
    data = body.encode() if isinstance(body, str) else body
    _s3().put_object(Bucket=settings.b2_bucket_name, Key=key, Body=data, ContentType=content_type)


def _get(key: str) -> bytes | None:
    try:
        resp = _s3().get_object(Bucket=settings.b2_bucket_name, Key=key)
        return resp["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return None
        raise


def _raw_prefix(snap_id: str) -> str:
    return f"{_PREFIX}/raw/issues/snapshot={snap_id}"


def _derived_prefix(snap_id: str, stage: str) -> str:
    return f"{_PREFIX}/derived/{stage}/snapshot={snap_id}"


def generate_snapshot_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def write_raw_snapshot(snapshot_id: str, issues: list[Issue], metadata: IssueMetadata) -> None:
    prefix = _raw_prefix(snapshot_id)
    lines = "\n".join(i.model_dump_json() for i in issues)
    _put(f"{prefix}/issues.jsonl", lines, "application/jsonl")
    _put(f"{prefix}/metadata.json", metadata.model_dump_json())
    logger.info("Wrote raw snapshot %s (%d issues)", snapshot_id, len(issues))


def read_raw_snapshot(snapshot_id: str) -> tuple[list[Issue], IssueMetadata]:
    prefix = _raw_prefix(snapshot_id)
    raw = _get(f"{prefix}/issues.jsonl")
    if raw is None:
        raise FileNotFoundError(f"Snapshot {snapshot_id} not found")
    issues = [Issue.model_validate_json(line) for line in raw.decode().strip().splitlines() if line]
    meta_raw = _get(f"{prefix}/metadata.json")
    metadata = IssueMetadata.model_validate_json(meta_raw) if meta_raw else IssueMetadata(
        repo="unknown", fetched_at=datetime.now(UTC), total_count=len(issues)
    )
    return issues, metadata


def write_embeddings(snapshot_id: str, records: list[dict]) -> None:
    import pyarrow as pa
    import pyarrow.parquet as pq

    table = pa.table({
        "issue_id": [r["issue_id"] for r in records],
        "embedding": [r["embedding"] for r in records],
        "model_id": [r["model_id"] for r in records],
        "content_hash": [r["content_hash"] for r in records],
    })
    buf = io.BytesIO()
    pq.write_table(table, buf)
    key = f"{_derived_prefix(snapshot_id, 'embeddings')}/embeddings.parquet"
    _put(key, buf.getvalue(), "application/octet-stream")


def read_embeddings(snapshot_id: str) -> list[dict]:
    import pyarrow.parquet as pq

    raw = _get(f"{_derived_prefix(snapshot_id, 'embeddings')}/embeddings.parquet")
    if raw is None:
        return []
    table = pq.read_table(io.BytesIO(raw))
    return table.to_pylist()


def write_classifications(snapshot_id: str, results: list[ClassificationResult]) -> None:
    lines = "\n".join(r.model_dump_json() for r in results)
    key = f"{_derived_prefix(snapshot_id, 'classifications')}/classified.jsonl"
    _put(key, lines, "application/jsonl")


def read_classifications(snapshot_id: str) -> list[ClassificationResult]:
    raw = _get(f"{_derived_prefix(snapshot_id, 'classifications')}/classified.jsonl")
    if raw is None:
        return []
    return [ClassificationResult.model_validate_json(line) for line in raw.decode().strip().splitlines() if line]


def write_clusters(
    snapshot_id: str, clusters: list[Cluster], assignments: list[ClusterAssignment]
) -> None:
    prefix = _derived_prefix(snapshot_id, "clusters")
    clusters_payload = json.dumps([c.model_dump() for c in clusters], default=str)
    _put(f"{prefix}/clusters.json", clusters_payload)
    lines = "\n".join(a.model_dump_json() for a in assignments)
    _put(f"{prefix}/assignments.jsonl", lines, "application/jsonl")


def read_clusters(snapshot_id: str) -> tuple[list[Cluster], list[ClusterAssignment]]:
    prefix = _derived_prefix(snapshot_id, "clusters")
    clusters_raw = _get(f"{prefix}/clusters.json")
    clusters = [Cluster.model_validate(c) for c in json.loads(clusters_raw or "[]")]
    assignments_raw = _get(f"{prefix}/assignments.jsonl")
    assignments = []
    if assignments_raw:
        assignments = [ClusterAssignment.model_validate_json(line)
                       for line in assignments_raw.decode().strip().splitlines() if line]
    return clusters, assignments


def write_report(snapshot_id: str, report: SnapshotReport) -> None:
    key = f"{_derived_prefix(snapshot_id, 'reports')}/report.json"
    _put(key, report.model_dump_json())


def read_report(snapshot_id: str) -> SnapshotReport | None:
    raw = _get(f"{_derived_prefix(snapshot_id, 'reports')}/report.json")
    return SnapshotReport.model_validate_json(raw) if raw else None


def write_snapshot_status(snapshot_id: str, status: SnapshotStatus) -> None:
    key = f"{_raw_prefix(snapshot_id)}/status.json"
    _put(key, status.model_dump_json())


def list_snapshots() -> list[SnapshotStatus]:
    prefix = f"{_PREFIX}/raw/issues/"
    try:
        resp = _s3().list_objects_v2(Bucket=settings.b2_bucket_name, Prefix=prefix, Delimiter="/")
    except ClientError as e:
        raise RuntimeError(f"B2 list snapshots failed: {e}") from e
    results = []
    for cp in resp.get("CommonPrefixes", []):
        snap_prefix = cp["Prefix"]
        snap_id = snap_prefix.rstrip("/").split("snapshot=")[-1]
        raw = _get(f"{snap_prefix}status.json")
        if raw:
            try:
                results.append(SnapshotStatus.model_validate_json(raw))
                continue
            except Exception:
                pass
        meta_raw = _get(f"{snap_prefix}metadata.json")
        if meta_raw:
            try:
                meta = IssueMetadata.model_validate_json(meta_raw)
                results.append(SnapshotStatus(
                    snapshot_id=snap_id, repo=meta.repo, fetched_at=meta.fetched_at,
                    status="complete", total_issues=meta.total_count,
                ))
                continue
            except Exception:
                pass
        results.append(SnapshotStatus(
            snapshot_id=snap_id, repo="unknown",
            fetched_at=datetime.now(UTC), status="unknown",
        ))
    results.sort(key=lambda s: s.snapshot_id, reverse=True)
    return results
