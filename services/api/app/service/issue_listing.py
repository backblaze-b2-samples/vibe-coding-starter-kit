from app.repo.intelligence_storage import (
    read_classifications,
    read_clusters,
    read_raw_snapshot,
    read_report,
)
from app.service.snapshots import SnapshotNotFoundServiceError
from app.types.cluster import Cluster
from app.types.report import IssueListItem, IssueListResponse, SnapshotReport, WeeklyActivity


def get_report(snapshot_id: str) -> SnapshotReport:
    report = read_report(snapshot_id)
    if report is None:
        raise SnapshotNotFoundServiceError(snapshot_id)
    return report


def get_clusters(snapshot_id: str) -> list[Cluster]:
    clusters, _ = read_clusters(snapshot_id)
    return clusters


def get_activity(snapshot_id: str) -> list[WeeklyActivity]:
    return get_report(snapshot_id).activity_timeline


def list_issues(
    snapshot_id: str,
    cluster_id: str | None,
    category: str | None,
    min_spec_depth: float,
    limit: int,
    offset: int,
) -> IssueListResponse:
    try:
        issues, _ = read_raw_snapshot(snapshot_id)
    except FileNotFoundError:
        raise SnapshotNotFoundServiceError(snapshot_id) from None
    class_by_id = {c.issue_id: c for c in read_classifications(snapshot_id)}
    _, assignments = read_clusters(snapshot_id)
    assign_by_id = {a.issue_id: a.cluster_id for a in assignments}

    items: list[IssueListItem] = []
    for issue in issues:
        c = class_by_id.get(issue.id)
        if c is None:
            continue
        if cluster_id and assign_by_id.get(issue.id) != cluster_id:
            continue
        if category and c.category != category:
            continue
        if c.spec_depth_score < min_spec_depth:
            continue
        items.append(
            IssueListItem(
                issue_id=issue.id,
                issue_number=issue.number,
                title=issue.title,
                html_url=issue.html_url,
                state=issue.state,
                category=c.category,
                b2_role=c.b2_role,
                spec_depth_score=c.spec_depth_score,
                cluster_id=assign_by_id.get(issue.id, "unclustered"),
                created_at=issue.created_at.isoformat(),
            )
        )
    return IssueListResponse(
        total=len(items), offset=offset, limit=limit, items=items[offset : offset + limit]
    )
