import logging
import time

import httpx

from app.config.intelligence import intel_settings
from app.types.issue import Issue, IssueLabel

logger = logging.getLogger(__name__)

_GITHUB_API = "https://api.github.com"
_PAGE_SIZE = 100


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


def fetch_issues(repo: str | None = None) -> tuple[list[Issue], int]:
    """Fetch all issues (open + closed) from GitHub. Returns (issues, rate_remaining).

    Raises RuntimeError on API failure or rate limit exceeded.
    Raises ValueError if issue count exceeds MAX_ISSUES_PER_RUN.
    """
    target = repo or intel_settings.github_repo
    owner, name = target.split("/", 1)
    issues: list[Issue] = []
    page = 1
    rate_remaining = 5000

    with httpx.Client(headers=_headers(), timeout=30) as client:
        for state in ("open", "closed"):
            page = 1
            while True:
                url = f"{_GITHUB_API}/repos/{owner}/{name}/issues"
                params = {"state": state, "per_page": _PAGE_SIZE, "page": page}
                resp = client.get(url, params=params)

                remaining = int(resp.headers.get("X-RateLimit-Remaining", 5000))
                rate_remaining = min(rate_remaining, remaining)

                if resp.status_code == 403 and remaining == 0:
                    reset_ts = int(resp.headers.get("X-RateLimit-Reset", time.time() + 60))
                    wait = max(1, reset_ts - int(time.time()))
                    logger.warning("GitHub rate limit hit; sleeping %ds", wait)
                    time.sleep(min(wait, 60))
                    continue

                if resp.status_code == 404:
                    raise RuntimeError(f"Repo not found: {target}")

                resp.raise_for_status()
                batch = resp.json()
                if not batch:
                    break

                # GitHub returns PRs in issues endpoint — filter them out
                for raw in batch:
                    if "pull_request" not in raw:
                        issues.append(_parse_issue(raw))

                total = len(issues)
                if total > intel_settings.max_issues_per_run:
                    raise ValueError(
                        f"Issue count {total} exceeds MAX_ISSUES_PER_RUN "
                        f"({intel_settings.max_issues_per_run}). "
                        "Increase config value to proceed."
                    )

                if len(batch) < _PAGE_SIZE:
                    break
                page += 1

    logger.info("Fetched %d issues from %s (rate_remaining=%d)", len(issues), target, rate_remaining)
    return issues, rate_remaining
