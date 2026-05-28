import logging

from app.repo.intelligence_storage import (
    list_snapshots,
    write_snapshot_status,
)
from app.service.analysis import run_analysis
from app.service.classification import run_classification
from app.service.clustering import run_clustering
from app.service.embeddings import run_embeddings
from app.service.ingestion import run_ingestion
from app.types.issue import SnapshotStatus

logger = logging.getLogger(__name__)


def run_full_pipeline(repo: str | None = None) -> tuple[str, dict]:
    """Run ingestion + all derived stages end-to-end.

    Returns (snapshot_id, cost_log).
    """
    snapshot_id, metadata = run_ingestion(repo)
    cost_log: dict = {}

    emb_cost = run_embeddings(snapshot_id)
    cost_log.update(emb_cost)

    cls_cost = run_classification(snapshot_id)
    cost_log.update(cls_cost)

    cluster_cost = run_clustering(snapshot_id)
    cost_log.update(cluster_cost)

    report = run_analysis(snapshot_id, pipeline_cost=cost_log)

    total_llm = (
        cost_log.get("llm_cost_usd", 0)
        + cost_log.get("llm_cluster_cost_usd", 0)
    )
    total_cost = cost_log.get("embedding_cost_usd", 0) + total_llm
    cost_log["total_cost_usd"] = round(total_cost, 6)

    status = SnapshotStatus(
        snapshot_id=snapshot_id,
        repo=metadata.repo,
        fetched_at=metadata.fetched_at,
        status="complete",
        total_issues=report.total_issues,
        open_issues=report.open_issues,
        closed_issues=report.closed_issues,
        cluster_count=len([c for c in report.clusters if c.cluster_id != "unclustered"]),
        pipeline_cost=cost_log,
    )
    write_snapshot_status(snapshot_id, status)

    logger.info(
        "Pipeline complete snapshot=%s total_cost_usd=%.4f",
        snapshot_id, total_cost,
    )
    return snapshot_id, cost_log


def reprocess_snapshot(snapshot_id: str) -> tuple[str, dict]:
    """Re-run all derived stages against an existing raw snapshot.

    Does NOT re-fetch from GitHub.
    """
    cost_log: dict = {}

    emb_cost = run_embeddings(snapshot_id)
    cost_log.update(emb_cost)

    cls_cost = run_classification(snapshot_id)
    cost_log.update(cls_cost)

    cluster_cost = run_clustering(snapshot_id)
    cost_log.update(cluster_cost)

    report = run_analysis(snapshot_id, pipeline_cost=cost_log)

    total_cost = (
        cost_log.get("embedding_cost_usd", 0)
        + cost_log.get("llm_cost_usd", 0)
        + cost_log.get("llm_cluster_cost_usd", 0)
    )
    cost_log["total_cost_usd"] = round(total_cost, 6)

    status = SnapshotStatus(
        snapshot_id=snapshot_id,
        repo=report.repo,
        fetched_at=report.generated_at,
        status="complete",
        total_issues=report.total_issues,
        open_issues=report.open_issues,
        closed_issues=report.closed_issues,
        cluster_count=len([c for c in report.clusters if c.cluster_id != "unclustered"]),
        pipeline_cost=cost_log,
    )
    write_snapshot_status(snapshot_id, status)
    return snapshot_id, cost_log


def get_all_snapshots() -> list[SnapshotStatus]:
    return list_snapshots()
