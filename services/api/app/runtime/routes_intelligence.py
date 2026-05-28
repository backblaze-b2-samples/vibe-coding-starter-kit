import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/intelligence")

# In-memory tracking for in-flight pipeline runs (single-process v0)
_running: dict[str, str] = {}


def _run_pipeline_bg(snapshot_id: str, repo: str | None) -> None:
    from app.service.snapshots import run_full_pipeline

    _running[snapshot_id] = "running"
    try:
        run_full_pipeline(repo)
        _running[snapshot_id] = "complete"
    except Exception as e:
        logger.error("Pipeline failed snapshot=%s error=%s", snapshot_id, e)
        _running[snapshot_id] = "failed"


def _run_reprocess_bg(snapshot_id: str) -> None:
    from app.service.snapshots import reprocess_snapshot

    _running[snapshot_id] = "running"
    try:
        reprocess_snapshot(snapshot_id)
        _running[snapshot_id] = "complete"
    except Exception as e:
        logger.error("Reprocess failed snapshot=%s error=%s", snapshot_id, e)
        _running[snapshot_id] = "failed"


@router.post("/snapshots", status_code=202)
async def trigger_snapshot(
    bg: BackgroundTasks,
    repo: Annotated[str | None, Body(embed=True)] = None,
):
    from datetime import UTC, datetime

    snapshot_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    _running[snapshot_id] = "running"
    bg.add_task(_run_pipeline_bg, snapshot_id, repo)
    return {"snapshot_id": snapshot_id, "status": "running"}


@router.get("/snapshots")
async def list_all_snapshots():
    from datetime import UTC, datetime

    from app.service.snapshots import get_all_snapshots
    from app.types.issue import SnapshotStatus

    snapshots = get_all_snapshots()
    for s in snapshots:
        if s.snapshot_id in _running:
            s.status = _running[s.snapshot_id]
    for snap_id, status in _running.items():
        if not any(s.snapshot_id == snap_id for s in snapshots):
            snapshots.insert(0, SnapshotStatus(
                snapshot_id=snap_id,
                repo="pending",
                fetched_at=datetime.now(UTC),
                status=status,
            ))
    return snapshots


@router.get("/snapshots/{snapshot_id}")
async def get_snapshot_report(snapshot_id: str):
    from app.repo.intelligence_storage import read_report

    status = _running.get(snapshot_id)
    if status == "running":
        raise HTTPException(status_code=202, detail="Pipeline still running")
    report = read_report(snapshot_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Snapshot {snapshot_id} not found")
    return report


@router.get("/snapshots/{snapshot_id}/issues")
async def get_snapshot_issues(
    snapshot_id: str,
    cluster_id: str | None = None,
    category: str | None = None,
    min_spec_depth: float = 0.0,
    limit: int = Query(50, le=500),
    offset: int = 0,
):
    from app.repo.intelligence_storage import read_classifications, read_clusters, read_raw_snapshot

    try:
        issues, _ = read_raw_snapshot(snapshot_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Snapshot {snapshot_id} not found") from None
    classifications = read_classifications(snapshot_id)
    _, assignments = read_clusters(snapshot_id)

    class_by_id = {c.issue_id: c for c in classifications}
    assign_by_id = {a.issue_id: a.cluster_id for a in assignments}

    results = []
    for issue in issues:
        c = class_by_id.get(issue.id)
        if not c:
            continue
        if cluster_id and assign_by_id.get(issue.id) != cluster_id:
            continue
        if category and c.category != category:
            continue
        if c.spec_depth_score < min_spec_depth:
            continue
        results.append({
            "issue_id": issue.id,
            "issue_number": issue.number,
            "title": issue.title,
            "html_url": issue.html_url,
            "state": issue.state,
            "category": c.category,
            "b2_role": c.b2_role,
            "spec_depth_score": c.spec_depth_score,
            "cluster_id": assign_by_id.get(issue.id, "unclustered"),
            "created_at": issue.created_at.isoformat(),
        })

    total = len(results)
    return {"total": total, "offset": offset, "limit": limit, "items": results[offset: offset + limit]}


@router.get("/snapshots/{snapshot_id}/clusters")
async def get_snapshot_clusters(snapshot_id: str):
    from app.repo.intelligence_storage import read_clusters

    clusters, _ = read_clusters(snapshot_id)
    return clusters


@router.get("/snapshots/{snapshot_id}/activity")
async def get_snapshot_activity(snapshot_id: str):
    from app.repo.intelligence_storage import read_report

    report = read_report(snapshot_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Snapshot {snapshot_id} not found")
    return report.activity_timeline


@router.post("/snapshots/{snapshot_id}/reprocess", status_code=202)
async def trigger_reprocess(snapshot_id: str, bg: BackgroundTasks):
    _running[snapshot_id] = "running"
    bg.add_task(_run_reprocess_bg, snapshot_id)
    return {"snapshot_id": snapshot_id, "status": "running"}
