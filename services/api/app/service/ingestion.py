import logging
from datetime import UTC, datetime

from app.config.intelligence import intel_settings
from app.repo.github_issues import fetch_issues
from app.repo.intelligence_storage import (
    generate_snapshot_id,
    write_raw_snapshot,
    write_snapshot_status,
)
from app.types.issue import IssueMetadata, SnapshotStatus

logger = logging.getLogger(__name__)


def run_ingestion(repo: str | None = None) -> tuple[str, IssueMetadata]:
    """Fetch issues from GitHub and write raw snapshot to B2.

    Returns (snapshot_id, metadata).
    Raises ValueError if issue count exceeds MAX_ISSUES_PER_RUN.
    Raises RuntimeError on GitHub API or B2 failure.
    """
    target = repo or intel_settings.github_repo
    snapshot_id = generate_snapshot_id()
    fetched_at = datetime.now(UTC)

    logger.info("Starting ingestion snapshot=%s repo=%s", snapshot_id, target)

    issues, rate_remaining = fetch_issues(target)

    metadata = IssueMetadata(
        repo=target,
        fetched_at=fetched_at,
        total_count=len(issues),
        api_rate_remaining=rate_remaining,
    )

    write_raw_snapshot(snapshot_id, issues, metadata)

    open_count = sum(1 for i in issues if i.state == "open")
    status = SnapshotStatus(
        snapshot_id=snapshot_id,
        repo=target,
        fetched_at=fetched_at,
        status="ingested",
        total_issues=len(issues),
        open_issues=open_count,
        closed_issues=len(issues) - open_count,
    )
    write_snapshot_status(snapshot_id, status)

    logger.info(
        "Ingestion complete snapshot=%s issues=%d open=%d closed=%d",
        snapshot_id, len(issues), open_count, len(issues) - open_count,
    )
    return snapshot_id, metadata
