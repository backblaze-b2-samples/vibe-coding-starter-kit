"""Access control and input validation for the intelligence routes.

The pipeline spends GitHub quota, Anthropic tokens and B2 writes, so the trigger
routes are off by default, need a bearer token when on, and only accept
repositories from an allow-list. Storage is an in-memory fake; the pipeline
itself is replaced by a recorder so nothing leaves the process.
"""

import pytest

from app.config.intelligence import intel_settings
from app.repo import intelligence_storage
from app.runtime import intelligence as routes
from app.service import snapshots
from tests.fake_s3 import FakeS3

SAMPLE_REPO = "backblaze-b2-samples/vibe-coding-starter-kit"
TOKEN = "test-admin-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}


@pytest.fixture
def store(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(intelligence_storage, "get_s3_client", lambda: fake)
    return fake


@pytest.fixture
def pipeline_calls(monkeypatch, store):
    calls: list[tuple] = []

    def record_full(repo, snapshot_id):
        calls.append(("full", repo, snapshot_id))

    def record_reprocess(snapshot_id):
        calls.append(("reprocess", snapshot_id))

    monkeypatch.setattr(routes, "run_full_pipeline", record_full)
    monkeypatch.setattr(routes, "reprocess_snapshot", record_reprocess)
    yield calls
    # Never leave the single-flight slot taken for the next test.
    snapshots.release_pipeline_slot()


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setattr(intel_settings, "intelligence_enabled", True)
    monkeypatch.setattr(intel_settings, "intelligence_admin_token", TOKEN)


@pytest.mark.asyncio
async def test_trigger_is_off_by_default(client, pipeline_calls):
    response = await client.post("/intelligence/snapshots", json={})
    assert response.status_code == 403
    assert pipeline_calls == []


@pytest.mark.asyncio
async def test_trigger_without_a_configured_token_is_refused(client, pipeline_calls, monkeypatch):
    monkeypatch.setattr(intel_settings, "intelligence_enabled", True)
    monkeypatch.setattr(intel_settings, "intelligence_admin_token", "")
    response = await client.post("/intelligence/snapshots", json={}, headers=AUTH)
    assert response.status_code == 403
    assert pipeline_calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"}, {"Authorization": TOKEN}])
async def test_trigger_needs_the_bearer_token(client, pipeline_calls, enabled, headers):
    response = await client.post("/intelligence/snapshots", json={}, headers=headers)
    assert response.status_code == 401
    assert pipeline_calls == []


@pytest.mark.asyncio
async def test_trigger_returns_the_id_the_pipeline_uses(client, pipeline_calls, enabled):
    response = await client.post("/intelligence/snapshots", json={}, headers=AUTH)
    assert response.status_code == 202
    body = response.json()
    assert pipeline_calls == [("full", SAMPLE_REPO, body["snapshot_id"])]


@pytest.mark.asyncio
async def test_trigger_defaults_to_the_public_sample_repo(client, pipeline_calls, enabled):
    await client.post("/intelligence/snapshots", json={"repo": None}, headers=AUTH)
    assert pipeline_calls[0][1] == SAMPLE_REPO
    assert intel_settings.github_repo == SAMPLE_REPO


@pytest.mark.asyncio
async def test_repo_outside_the_allow_list_is_rejected(client, pipeline_calls, enabled):
    response = await client.post(
        "/intelligence/snapshots", json={"repo": "someone-else/other-repo"}, headers=AUTH
    )
    assert response.status_code == 400
    assert pipeline_calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_repo",
    [
        "owner/name/extra",
        "../x",
        "owner/..",
        "owner/.",
        "owner",
        "owner/na me",
        "https://example.com/a/b",
        "owner/name?x=1",
        "owner/name#frag",
        "/owner/name",
        "owner//name",
        "",
    ],
)
async def test_malformed_repo_is_rejected_before_any_work(client, pipeline_calls, enabled, monkeypatch, bad_repo):
    # Even if the allow-list were widened, a malformed value must not pass.
    monkeypatch.setattr(intel_settings, "github_allowed_repos", bad_repo or "x/y")
    response = await client.post("/intelligence/snapshots", json={"repo": bad_repo}, headers=AUTH)
    assert response.status_code in (400, 422)
    assert pipeline_calls == []


@pytest.mark.asyncio
async def test_an_allow_listed_repo_is_accepted(client, pipeline_calls, enabled, monkeypatch):
    monkeypatch.setattr(intel_settings, "github_allowed_repos", f"{SAMPLE_REPO},octo-org/demo.app")
    response = await client.post(
        "/intelligence/snapshots", json={"repo": "octo-org/demo.app"}, headers=AUTH
    )
    assert response.status_code == 202
    assert pipeline_calls[0][1] == "octo-org/demo.app"


@pytest.mark.asyncio
async def test_a_second_trigger_while_one_is_running_is_refused(client, store, enabled, monkeypatch):
    monkeypatch.setattr(routes, "run_full_pipeline", lambda repo, snapshot_id: None)
    taken = snapshots.begin_snapshot(None)
    try:
        response = await client.post("/intelligence/snapshots", json={}, headers=AUTH)
        assert response.status_code == 409
    finally:
        snapshots.release_pipeline_slot()
    assert taken[0]


@pytest.mark.asyncio
async def test_reprocess_is_off_by_default(client, pipeline_calls):
    response = await client.post("/intelligence/snapshots/20260101T000000Z/reprocess")
    assert response.status_code == 403
    assert pipeline_calls == []


@pytest.mark.asyncio
async def test_reprocess_needs_the_bearer_token(client, pipeline_calls, enabled):
    response = await client.post("/intelligence/snapshots/20260101T000000Z/reprocess")
    assert response.status_code == 401
    assert pipeline_calls == []


@pytest.mark.asyncio
async def test_reprocess_unknown_snapshot_is_404(client, pipeline_calls, enabled):
    response = await client.post("/intelligence/snapshots/20260101T000000Z/reprocess", headers=AUTH)
    assert response.status_code == 404
    assert pipeline_calls == []


@pytest.mark.asyncio
async def test_reprocess_existing_snapshot(client, pipeline_calls, enabled, store):
    prefix = "intelligence/raw/issues/snapshot=20260101T000000Z"
    store.objects[f"{prefix}/issues.jsonl"] = b""
    response = await client.post("/intelligence/snapshots/20260101T000000Z/reprocess", headers=AUTH)
    assert response.status_code == 202
    assert pipeline_calls == [("reprocess", "20260101T000000Z")]


@pytest.mark.asyncio
@pytest.mark.parametrize("bad_id", ["x", "2026-01-01", "20260101T000000", "..%2F..%2Fuploads", "20260101T000000Zextra"])
async def test_snapshot_ids_are_validated_everywhere(client, pipeline_calls, enabled, store, bad_id):
    paths = [
        ("get", f"/intelligence/snapshots/{bad_id}"),
        ("get", f"/intelligence/snapshots/{bad_id}/issues"),
        ("get", f"/intelligence/snapshots/{bad_id}/clusters"),
        ("get", f"/intelligence/snapshots/{bad_id}/activity"),
        ("post", f"/intelligence/snapshots/{bad_id}/reprocess"),
    ]
    for method, path in paths:
        response = await getattr(client, method)(path, headers=AUTH)
        assert response.status_code in (404, 422), path
    assert pipeline_calls == []
    assert store.objects == {}


@pytest.mark.asyncio
async def test_listing_and_reading_stay_public(client, store):
    assert (await client.get("/intelligence/snapshots")).status_code == 200
    assert (await client.get("/intelligence/snapshots/20260101T000000Z")).status_code == 404
