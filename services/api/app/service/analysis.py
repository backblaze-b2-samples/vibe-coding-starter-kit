import logging
from collections import Counter, defaultdict
from datetime import UTC, datetime

from app.config.intelligence import intel_settings
from app.repo.intelligence_storage import (
    read_classifications,
    read_clusters,
    read_raw_snapshot,
    write_report,
)
from app.types.classification import B2Role, IssueCategory
from app.types.report import (
    B2RoleCount,
    CategoryCount,
    IssueSummary,
    SnapshotReport,
    SpecDepthBucket,
    WeeklyActivity,
)

logger = logging.getLogger(__name__)

_DEPTH_BUCKETS = [("0-2", 0, 2), ("3-4", 3, 4), ("5-6", 5, 6), ("7-8", 7, 8), ("9-10", 9, 10)]


def _iso_week(dt: datetime) -> str:
    return dt.strftime("%G-W%V")


def run_analysis(snapshot_id: str, pipeline_cost: dict | None = None) -> SnapshotReport:
    """Assemble dashboard payload from all derived stages."""
    issues, metadata = read_raw_snapshot(snapshot_id)
    classifications = read_classifications(snapshot_id)
    clusters, assignments = read_clusters(snapshot_id)

    assign_by_id = {a.issue_id: a.cluster_id for a in assignments}
    cluster_by_id = {c.cluster_id: c for c in clusters}

    total = len(issues)
    open_count = sum(1 for i in issues if i.state == "open")

    cat_counter: Counter[IssueCategory] = Counter(c.category for c in classifications)
    category_breakdown = [
        CategoryCount(
            category=cat,
            count=cnt,
            percentage=round(cnt / total * 100, 1) if total else 0.0,
        )
        for cat, cnt in cat_counter.most_common()
    ]

    role_counter: Counter[B2Role] = Counter(c.b2_role for c in classifications)
    b2_role_distribution = [B2RoleCount(role=role, count=cnt) for role, cnt in role_counter.most_common()]

    activity: dict[tuple[str, str], dict] = defaultdict(lambda: {"created": 0, "updated": 0})
    for issue in issues:
        cid = assign_by_id.get(issue.id, "unclustered")
        clabel = cluster_by_id.get(cid)
        week = _iso_week(issue.created_at)
        key = (week, cid)
        activity[key]["created"] += 1
        activity[key]["label"] = clabel.label if clabel else "Unclustered"
        upd_week = _iso_week(issue.updated_at)
        activity[(upd_week, cid)]["updated"] += 1
        activity[(upd_week, cid)].setdefault("label", clabel.label if clabel else "Unclustered")

    activity_timeline = [
        WeeklyActivity(
            week=week,
            cluster_id=cid,
            cluster_label=vals.get("label", "Unclustered"),
            created_count=vals.get("created", 0),
            updated_count=vals.get("updated", 0),
        )
        for (week, cid), vals in sorted(activity.items())
    ]

    depth_counts: dict[str, int] = {label: 0 for label, _, _ in _DEPTH_BUCKETS}
    for c in classifications:
        for label, lo, hi in _DEPTH_BUCKETS:
            if lo <= c.spec_depth_score <= hi:
                depth_counts[label] += 1
                break
    spec_depth_histogram = [SpecDepthBucket(score_range=k, count=v) for k, v in depth_counts.items()]

    summaries: list[IssueSummary] = []
    issue_by_id = {i.id: i for i in issues}
    for c in classifications:
        issue = issue_by_id.get(c.issue_id)
        if not issue:
            continue
        cid = assign_by_id.get(c.issue_id, "unclustered")
        clabel = cluster_by_id.get(cid)
        summaries.append(IssueSummary(
            issue_id=c.issue_id,
            issue_number=c.issue_number,
            title=issue.title,
            html_url=issue.html_url,
            category=c.category,
            b2_role=c.b2_role,
            spec_depth_score=c.spec_depth_score,
            cluster_id=cid,
            cluster_label=clabel.label if clabel else "Unclustered",
        ))

    top_n = intel_settings.top_n_issues
    spec_summaries = sorted(
        [s for s in summaries if s.category == IssueCategory.SAMPLE_APP_SPEC],
        key=lambda s: s.spec_depth_score,
        reverse=True,
    )
    top_specs = spec_summaries[:top_n]
    thin_issues = sorted(summaries, key=lambda s: s.spec_depth_score)[:top_n]

    report = SnapshotReport(
        snapshot_id=snapshot_id,
        repo=metadata.repo,
        generated_at=datetime.now(UTC),
        total_issues=total,
        open_issues=open_count,
        closed_issues=total - open_count,
        clusters=clusters,
        category_breakdown=category_breakdown,
        b2_role_distribution=b2_role_distribution,
        activity_timeline=activity_timeline,
        spec_depth_histogram=spec_depth_histogram,
        top_specs=top_specs,
        thin_issues=thin_issues,
        pipeline_cost=pipeline_cost or {},
    )
    write_report(snapshot_id, report)
    logger.info("Analysis complete snapshot=%s", snapshot_id)
    return report
