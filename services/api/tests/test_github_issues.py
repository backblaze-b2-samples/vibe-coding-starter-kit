"""GitHub adapter: strict repo syntax, bounded work, no accidental credentials."""

import httpx
import pytest

from app.config.intelligence import intel_settings
from app.repo import github_issues

REPO = "backblaze-b2-samples/vibe-coding-starter-kit"


def _raw(n: int, pull: bool = False) -> dict:
    raw = {
        "id": n, "number": n, "title": f"t{n}", "body": "b", "state": "open",
        "user": {"login": "u"}, "labels": [],
        "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z",
        "closed_at": None, "html_url": f"https://github.com/o/r/issues/{n}",
    }
    if pull:
        raw["pull_request"] = {}
    return raw


@pytest.fixture
def requests_seen(monkeypatch):
    seen: list[httpx.Request] = []
    pages: dict[tuple[str, int], list[dict]] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        state = request.url.params["state"]
        page = int(request.url.params["page"])
        return httpx.Response(200, json=pages.get((state, page), []), headers={"X-RateLimit-Remaining": "50"})

    real_client = httpx.Client

    def client_factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(github_issues.httpx, "Client", client_factory)
    seen_pages = pages
    return seen, seen_pages


@pytest.mark.parametrize(
    "bad",
    ["a/b/c", "../x", "owner/..", "owner/.", "owner", "o/n m", "x://a/b", "a/b?c", "a/b#c", "/a/b", "a//b", "", "a/b\n"],
)
def test_malformed_repo_raises_before_any_request(requests_seen, bad):
    seen, _ = requests_seen
    with pytest.raises(ValueError):
        github_issues.fetch_issues(bad, max_issues=10)
    assert seen == []


def test_builds_the_repo_issues_url_and_filters_pull_requests(requests_seen):
    seen, pages = requests_seen
    pages[("open", 1)] = [_raw(1), _raw(2, pull=True), _raw(3)]
    issues, _ = github_issues.fetch_issues(REPO, max_issues=10)
    assert [i.number for i in issues] == [1, 3]
    assert {r.url.path for r in seen} == {f"/repos/{REPO}/issues"}
    assert {r.url.host for r in seen} == {"api.github.com"}


def test_stops_fetching_once_the_cap_is_exceeded(requests_seen):
    seen, pages = requests_seen
    pages[("open", 1)] = [_raw(n) for n in range(1, 101)]
    pages[("open", 2)] = [_raw(n) for n in range(101, 201)]
    pages[("open", 3)] = [_raw(n) for n in range(201, 301)]
    with pytest.raises(ValueError):
        github_issues.fetch_issues(REPO, max_issues=50)
    assert len(seen) == 1


def test_no_authorization_header_without_a_token(requests_seen, monkeypatch):
    seen, _ = requests_seen
    monkeypatch.setattr(intel_settings, "github_token", "")
    github_issues.fetch_issues(REPO, max_issues=10)
    assert all("authorization" not in r.headers for r in seen)


def test_token_is_sent_as_a_bearer_header_only_when_configured(requests_seen, monkeypatch):
    seen, _ = requests_seen
    monkeypatch.setattr(intel_settings, "github_token", "synthetic-token")
    github_issues.fetch_issues(REPO, max_issues=10)
    assert all(r.headers["authorization"] == "Bearer synthetic-token" for r in seen)
