import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Header, HTTPException, Path, Query

from app.config.intelligence import intel_settings
from app.service.ingestion import RepoNotAllowedError
from app.service.issue_listing import get_activity, get_clusters, get_report, list_issues
from app.service.snapshots import (
    PipelineBusyError,
    SnapshotNotFoundServiceError,
    begin_reprocess,
    begin_snapshot,
    get_all_snapshots,
    release_pipeline_slot,
    reprocess_snapshot,
    run_full_pipeline,
)
from app.types.cluster import Cluster
from app.types.issue import SNAPSHOT_ID_PATTERN, SnapshotStatus
from app.types.report import IssueListResponse, SnapshotReport, WeeklyActivity

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/intelligence", tags=["intelligence"])

SnapshotId = Annotated[str, Path(pattern=SNAPSHOT_ID_PATTERN)]

# SECURITY: reads are unauthenticated like the rest of this API (see
# docs/SECURITY.md). The two POST routes spend GitHub quota and LLM tokens, so
# they are disabled unless INTELLIGENCE_ENABLED is set, and then require
# `Authorization: Bearer <INTELLIGENCE_ADMIN_TOKEN>`.


def require_pipeline_access(authorization: Annotated[str | None, Header()] = None) -> None:
    token = intel_settings.intelligence_admin_token
    if not intel_settings.intelligence_enabled or not token:
        raise HTTPException(status_code=403, detail="Pipeline triggers are disabled")
    scheme, _, supplied = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not hmac.compare_digest(supplied.encode(), token.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")


def _run_pipeline_bg(snapshot_id: str, repo: str) -> None:
    try:
        run_full_pipeline(repo, snapshot_id)
    except Exception:
        logger.error("Pipeline failed snapshot=%s", snapshot_id)  # status already marked failed
    finally:
        release_pipeline_slot()


def _run_reprocess_bg(snapshot_id: str) -> None:
    try:
        reprocess_snapshot(snapshot_id)
    except Exception:
        logger.error("Reprocess failed snapshot=%s", snapshot_id)
    finally:
        release_pipeline_slot()


def _not_found(e: SnapshotNotFoundServiceError) -> HTTPException:
    return HTTPException(status_code=404, detail=e.detail)


@router.post("/snapshots", status_code=202, dependencies=[Depends(require_pipeline_access)])
def trigger_snapshot(
    bg: BackgroundTasks,
    repo: Annotated[str | None, Body(embed=True)] = None,
) -> dict[str, str]:
    try:
        snapshot_id, target = begin_snapshot(repo)
    except RepoNotAllowedError as e:
        raise HTTPException(status_code=400, detail=e.detail) from None
    except PipelineBusyError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None
    bg.add_task(_run_pipeline_bg, snapshot_id, target)
    return {"snapshot_id": snapshot_id, "status": "running"}


@router.get("/snapshots")
def list_all_snapshots() -> list[SnapshotStatus]:
    try:
        return get_all_snapshots()
    except RuntimeError:
        raise HTTPException(status_code=502, detail="Failed to read snapshots from storage") from None


@router.get("/snapshots/{snapshot_id}")
def get_snapshot_report(snapshot_id: SnapshotId) -> SnapshotReport:
    try:
        return get_report(snapshot_id)
    except SnapshotNotFoundServiceError as e:
        raise _not_found(e) from None


@router.get("/snapshots/{snapshot_id}/issues")
def get_snapshot_issues(
    snapshot_id: SnapshotId,
    cluster_id: str | None = None,
    category: str | None = None,
    min_spec_depth: float = 0.0,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> IssueListResponse:
    try:
        return list_issues(snapshot_id, cluster_id, category, min_spec_depth, limit, offset)
    except SnapshotNotFoundServiceError as e:
        raise _not_found(e) from None


@router.get("/snapshots/{snapshot_id}/clusters")
def get_snapshot_clusters(snapshot_id: SnapshotId) -> list[Cluster]:
    return get_clusters(snapshot_id)


@router.get("/snapshots/{snapshot_id}/activity")
def get_snapshot_activity(snapshot_id: SnapshotId) -> list[WeeklyActivity]:
    try:
        return get_activity(snapshot_id)
    except SnapshotNotFoundServiceError as e:
        raise _not_found(e) from None


@router.post(
    "/snapshots/{snapshot_id}/reprocess",
    status_code=202,
    dependencies=[Depends(require_pipeline_access)],
)
def trigger_reprocess(snapshot_id: SnapshotId, bg: BackgroundTasks) -> dict[str, str]:
    try:
        begin_reprocess(snapshot_id)
    except SnapshotNotFoundServiceError as e:
        raise _not_found(e) from None
    except PipelineBusyError as e:
        raise HTTPException(status_code=409, detail=str(e)) from None
    bg.add_task(_run_reprocess_bg, snapshot_id)
    return {"snapshot_id": snapshot_id, "status": "running"}
