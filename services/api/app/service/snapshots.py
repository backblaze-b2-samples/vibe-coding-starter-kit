import logging
from datetime import UTC, datetime
from threading import Lock

from app.repo.intelligence_storage import (
    generate_snapshot_id,
    list_snapshots,
    read_snapshot_status,
    snapshot_exists,
    write_snapshot_status,
)
from app.service.analysis import run_analysis
from app.service.classification import run_classification
from app.service.clustering import run_clustering
from app.service.embeddings import run_embeddings
from app.service.ingestion import resolve_repo, run_ingestion
from app.types.issue import SnapshotStatus

logger = logging.getLogger(__name__)

FAILED_MESSAGE = "Pipeline failed; see the server logs."

# One pipeline at a time per process: each run spends GitHub quota, LLM tokens
# and B2 writes, so concurrent triggers must queue behind the caller, not stack.
_slot = Lock()


class PipelineBusyError(Exception):
    """A pipeline run is already in progress."""


class SnapshotNotFoundServiceError(Exception):
    """The snapshot does not exist."""

    def __init__(self, snapshot_id: str):
        self.detail = f"Snapshot {snapshot_id} not found"
        super().__init__(self.detail)


def release_pipeline_slot() -> None:
    if _slot.locked():
        _slot.release()


def _take_slot() -> None:
    if not _slot.acquire(blocking=False):
        raise PipelineBusyError("A pipeline run is already in progress")


def begin_snapshot(repo: str | None, snapshot_id: str | None = None) -> tuple[str, str]:
    """Validate the repo, take the single run slot and record a `running` status.

    Returns (snapshot_id, repo). The caller must run `run_full_pipeline` with
    exactly these values and then `release_pipeline_slot()`.
    Raises RepoNotAllowedError or PipelineBusyError.
    """
    target = resolve_repo(repo)
    _take_slot()
    try:
        sid = snapshot_id or generate_snapshot_id()
        write_snapshot_status(
            sid, SnapshotStatus(snapshot_id=sid, repo=target, fetched_at=datetime.now(UTC), status="running")
        )
    except Exception:
        release_pipeline_slot()
        raise
    return sid, target


def begin_reprocess(snapshot_id: str) -> None:
    """Take the single run slot for a reprocess of an existing snapshot.

    Raises SnapshotNotFoundServiceError or PipelineBusyError.
    """
    if not snapshot_exists(snapshot_id):
        raise SnapshotNotFoundServiceError(snapshot_id)
    _take_slot()


def _mark_failed(snapshot_id: str, repo: str) -> None:
    previous = read_snapshot_status(snapshot_id)
    failed = (previous or SnapshotStatus(
        snapshot_id=snapshot_id, repo=repo, fetched_at=datetime.now(UTC)
    )).model_copy(update={"status": "failed", "error": FAILED_MESSAGE})
    try:
        write_snapshot_status(snapshot_id, failed)
    except Exception:
        logger.exception("Could not record failed status snapshot=%s", snapshot_id)


def _derived_stages(snapshot_id: str) -> tuple[object, dict]:
    cost_log: dict = {}
    cost_log.update(run_embeddings(snapshot_id))
    cost_log.update(run_classification(snapshot_id))
    cost_log.update(run_clustering(snapshot_id))
    report = run_analysis(snapshot_id, pipeline_cost=cost_log)
    cost_log["total_cost_usd"] = round(
        cost_log.get("embedding_cost_usd", 0)
        + cost_log.get("llm_cost_usd", 0)
        + cost_log.get("llm_cluster_cost_usd", 0),
        6,
    )
    return report, cost_log


def _complete(snapshot_id: str, repo: str, fetched_at: datetime, report, cost_log: dict) -> None:
    write_snapshot_status(
        snapshot_id,
        SnapshotStatus(
            snapshot_id=snapshot_id,
            repo=repo,
            fetched_at=fetched_at,
            status="complete",
            total_issues=report.total_issues,
            open_issues=report.open_issues,
            closed_issues=report.closed_issues,
            cluster_count=len([c for c in report.clusters if c.cluster_id != "unclustered"]),
            pipeline_cost=cost_log,
        ),
    )


def run_full_pipeline(repo: str | None = None, snapshot_id: str | None = None) -> tuple[str, dict]:
    """Ingest and run every derived stage under ONE snapshot id.

    `snapshot_id` is the id the caller already told its client about; when it is
    omitted a new one is minted. Any failure marks that snapshot `failed` (with
    a generic message) before the exception propagates. Returns (snapshot_id,
    cost_log).
    """
    sid = snapshot_id or generate_snapshot_id()
    target = repo or ""
    try:
        _, metadata = run_ingestion(repo, sid)
        target = metadata.repo
        report, cost_log = _derived_stages(sid)
        _complete(sid, metadata.repo, metadata.fetched_at, report, cost_log)
    except Exception:
        logger.exception("Pipeline failed snapshot=%s", sid)
        _mark_failed(sid, target)
        raise
    logger.info("Pipeline complete snapshot=%s total_cost_usd=%.4f", sid, cost_log["total_cost_usd"])
    return sid, cost_log


def reprocess_snapshot(snapshot_id: str) -> tuple[str, dict]:
    """Re-run the derived stages on an existing raw snapshot (no GitHub fetch)."""
    if not snapshot_exists(snapshot_id):
        raise SnapshotNotFoundServiceError(snapshot_id)
    previous = read_snapshot_status(snapshot_id)
    try:
        report, cost_log = _derived_stages(snapshot_id)
        _complete(
            snapshot_id,
            report.repo,
            previous.fetched_at if previous else report.generated_at,
            report,
            cost_log,
        )
    except Exception:
        logger.exception("Reprocess failed snapshot=%s", snapshot_id)
        _mark_failed(snapshot_id, previous.repo if previous else "unknown")
        raise
    return snapshot_id, cost_log


def get_all_snapshots() -> list[SnapshotStatus]:
    return list_snapshots()
