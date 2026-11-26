import logging
import time

import httpx

from app.config.intelligence import intel_settings
from app.types.issue import REPO_RE, Issue, IssueLabel

logger = logging.getLogger(__name__)

_GITHUB_API = "https://api.github.com"
_PAGE_SIZE = 100
_MAX_RATE_LIMIT_WAITS = 2


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if intel_settings.github_token:
        h["Authorization"] = f"Bearer {intel_settings.github_token}"
    return h


def _parse_issue(raw: dict) -> Issue:
    labels = [IssueLabel(name=lb["name"], color=lb.get("color", "")) for lb in raw.get("labels", [])]
    return Issue(
        id=raw["id"],
        number=raw["number"],
        title=raw.get("title") or "",
        body=raw.get("body"),
        state=raw.get("state", "open"),
        user_login=raw.get("user", {}).get("login", ""),
        labels=labels,
        created_at=raw["created_at"],
        updated_at=raw["updated_at"],
        closed_at=raw.get("closed_at"),
        html_url=raw["html_url"],
    )


def fetch_issues(repo: str, max_issues: int) -> tuple[list[Issue], int]:
    """Fetch issues (open + closed, pull requests excluded) from GitHub.

    Returns (issues, rate_remaining). `repo` must be a strict `owner/name`; it
    is checked here, before any URL is built. Raises ValueError for a malformed
    repo or when more than `max_issues` issues exist (fetching stops at that
    page), and RuntimeError on a missing repo or an exhausted rate limit.
    """
    if not REPO_RE.fullmatch(repo):
        raise ValueError("repo must be of the form owner/name")
    owner, name = repo.split("/")
    url = f"{_GITHUB_API}/repos/{owner}/{name}/issues"
    issues: list[Issue] = []
    rate_remaining = 5000

    with httpx.Client(headers=_headers(), timeout=30) as client:
        for state in ("open", "closed"):
            page = 1
            waits = 0
            while True:
                resp = client.get(url, params={"state": state, "per_page": _PAGE_SIZE, "page": page})

                remaining = int(resp.headers.get("X-RateLimit-Remaining", 5000))
                rate_remaining = min(rate_remaining, remaining)

                if resp.status_code == 403 and remaining == 0:
                    if waits >= _MAX_RATE_LIMIT_WAITS:
                        raise RuntimeError("GitHub rate limit exhausted")
                    waits += 1
                    reset_ts = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
                    wait = max(1, reset_ts - int(time.time()))
                    logger.warning("GitHub rate limit hit; sleeping %ds", min(wait, 60))
                    time.sleep(min(wait, 60))
                    continue

                if resp.status_code == 404:
                    raise RuntimeError(f"Repo not found: {repo}")

                resp.raise_for_status()
                batch = resp.json()
                if not batch:
                    break

                issues.extend(_parse_issue(raw) for raw in batch if "pull_request" not in raw)

                if len(issues) > max_issues:
                    raise ValueError(
                        f"More than {max_issues} issues (MAX_ISSUES_PER_RUN); "
                        "raise the limit deliberately to proceed."
                    )

                if len(batch) < _PAGE_SIZE:
                    break
                page += 1

    logger.info("Fetched %d issues from %s (rate_remaining=%d)", len(issues), repo, rate_remaining)
    return issues, rate_remaining
