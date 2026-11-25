import logging
from datetime import UTC, datetime

from app.config.intelligence import intel_settings
from app.repo.github_issues import fetch_issues
from app.repo.intelligence_storage import write_raw_snapshot, write_snapshot_status
from app.types.issue import REPO_RE, IssueMetadata, SnapshotStatus

logger = logging.getLogger(__name__)


class RepoNotAllowedError(Exception):
    """The requested repository is malformed or not on the allow-list."""

    def __init__(self, detail: str = "Repository is not allowed"):
        self.detail = detail
        super().__init__(detail)


def resolve_repo(repo: str | None) -> str:
    """The repo to analyse: the configured default, or an allow-listed override.

    Raises RepoNotAllowedError for a malformed value or one that is not in
    GITHUB_ALLOWED_REPOS. The allow-list is checked on every entry path (API,
    CLI), never only at the HTTP edge.
    """
    target = repo if repo is not None else intel_settings.github_repo
    if not REPO_RE.fullmatch(target):
        raise RepoNotAllowedError("Repository must be of the form owner/name")
    if target not in intel_settings.allowed_repos:
        raise RepoNotAllowedError()
    return target


def run_ingestion(repo: str | None, snapshot_id: str) -> tuple[str, IssueMetadata]:
    """Fetch issues from GitHub and write the raw snapshot under `snapshot_id`.

    Returns (snapshot_id, metadata). Raises RepoNotAllowedError before any
    request for a repo that is not allowed, ValueError if more than
    MAX_ISSUES_PER_RUN issues exist, and RuntimeError on GitHub or B2 failure.
    """
    target = resolve_repo(repo)
    fetched_at = datetime.now(UTC)
    logger.info("Starting ingestion snapshot=%s repo=%s", snapshot_id, target)

    issues, rate_remaining = fetch_issues(target, intel_settings.max_issues_per_run)
    metadata = IssueMetadata(
        repo=target,
        fetched_at=fetched_at,
        total_count=len(issues),
        api_rate_remaining=rate_remaining,
    )
    write_raw_snapshot(snapshot_id, issues, metadata)

    open_count = sum(1 for i in issues if i.state == "open")
    write_snapshot_status(
        snapshot_id,
        SnapshotStatus(
            snapshot_id=snapshot_id,
            repo=target,
            fetched_at=fetched_at,
            status="ingested",
            total_issues=len(issues),
            open_issues=open_count,
            closed_issues=len(issues) - open_count,
        ),
    )
    logger.info(
        "Ingestion complete snapshot=%s issues=%d open=%d closed=%d",
        snapshot_id, len(issues), open_count, len(issues) - open_count,
    )
    return snapshot_id, metadata
