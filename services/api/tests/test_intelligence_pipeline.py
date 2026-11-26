"""Pipeline orchestration: one snapshot id end to end, and honest failure status."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.config.intelligence import intel_settings
from app.repo import intelligence_storage
from app.service import ingestion, snapshots
from app.types.issue import Issue
from tests.fake_s3 import FakeS3

SAMPLE_REPO = "backblaze-b2-samples/vibe-coding-starter-kit"
SNAP = "20260102T030405Z"
STATUS_KEY = f"intelligence/raw/issues/snapshot={SNAP}/status.json"


def _issue(n: int) -> Issue:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    return Issue(
        id=n, number=n, title=f"Issue {n}", body="body", state="open", user_login="u",
        created_at=now, updated_at=now, html_url=f"https://github.com/o/r/issues/{n}",
    )


@pytest.fixture
def store(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(intelligence_storage, "get_s3_client", lambda: fake)
    return fake


def _status(store: FakeS3, snap: str = SNAP) -> dict:
    return json.loads(store.objects[f"intelligence/raw/issues/snapshot={snap}/status.json"])


def test_ingestion_writes_under_the_id_it_is_given(store, monkeypatch):
    monkeypatch.setattr(ingestion, "fetch_issues", lambda repo, max_issues: ([_issue(1)], 4000))
    snapshot_id, metadata = ingestion.run_ingestion(SAMPLE_REPO, SNAP)
    assert snapshot_id == SNAP
    assert metadata.repo == SAMPLE_REPO
    assert f"intelligence/raw/issues/snapshot={SNAP}/issues.jsonl" in store.objects
    assert _status(store)["status"] == "ingested"


def test_ingestion_refuses_a_repo_outside_the_allow_list(store, monkeypatch):
    called = []
    monkeypatch.setattr(ingestion, "fetch_issues", lambda repo, max_issues: called.append(repo) or ([], 0))
    with pytest.raises(ingestion.RepoNotAllowedError):
        ingestion.run_ingestion("someone-else/other", SNAP)
    assert called == []
    assert store.objects == {}


def test_ingestion_passes_the_configured_issue_cap_to_the_fetch(store, monkeypatch):
    seen = {}
    monkeypatch.setattr(ingestion, "fetch_issues", lambda repo, max_issues: seen.setdefault("cap", max_issues) and ([], 0))
    ingestion.run_ingestion(SAMPLE_REPO, SNAP)
    assert seen["cap"] == intel_settings.max_issues_per_run


def test_default_issue_cap_is_conservative():
    assert intel_settings.max_issues_per_run <= 200


def _stub_stages(monkeypatch, fail_in: str | None = None):
    def stage(name):
        def run(snapshot_id, *args, **kwargs):
            if name == fail_in:
                raise RuntimeError("secret internal detail")
            return {f"{name}_cost_usd": 0.0}
        return run

    monkeypatch.setattr(snapshots, "run_embeddings", stage("embeddings"))
    monkeypatch.setattr(snapshots, "run_classification", stage("classification"))
    monkeypatch.setattr(snapshots, "run_clustering", stage("clustering"))

    report = SimpleNamespace(
        total_issues=1,
        open_issues=1,
        closed_issues=0,
        clusters=[],
        repo=SAMPLE_REPO,
        generated_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    monkeypatch.setattr(snapshots, "run_analysis", lambda snapshot_id, pipeline_cost=None: report)


def test_full_pipeline_completes_under_the_id_it_is_given(store, monkeypatch):
    monkeypatch.setattr(ingestion, "fetch_issues", lambda repo, max_issues: ([_issue(1)], 4000))
    _stub_stages(monkeypatch)
    snapshot_id, _ = snapshots.run_full_pipeline(SAMPLE_REPO, SNAP)
    assert snapshot_id == SNAP
    assert _status(store)["status"] == "complete"
    # Nothing was written under any other id.
    assert {k.split("snapshot=")[1].split("/")[0] for k in store.objects} == {SNAP}


@pytest.mark.parametrize("stage", ["embeddings", "classification", "clustering"])
def test_a_failed_stage_marks_the_snapshot_failed(store, monkeypatch, stage):
    monkeypatch.setattr(ingestion, "fetch_issues", lambda repo, max_issues: ([_issue(1)], 4000))
    _stub_stages(monkeypatch, fail_in=stage)
    with pytest.raises(RuntimeError):
        snapshots.run_full_pipeline(SAMPLE_REPO, SNAP)
    status = _status(store)
    assert status["status"] == "failed"
    assert "secret internal detail" not in json.dumps(status)


def test_a_failed_fetch_marks_the_snapshot_failed(store, monkeypatch):
    def boom(repo, max_issues):
        raise ValueError("too many issues")

    monkeypatch.setattr(ingestion, "fetch_issues", boom)
    _stub_stages(monkeypatch)
    snapshots.begin_snapshot(None, snapshot_id=SNAP)
    try:
        with pytest.raises(ValueError):
            snapshots.run_full_pipeline(SAMPLE_REPO, SNAP)
    finally:
        snapshots.release_pipeline_slot()
    assert _status(store)["status"] == "failed"


def test_begin_snapshot_records_running_status_and_holds_the_slot(store):
    snapshot_id, repo = snapshots.begin_snapshot(None)
    try:
        assert repo == SAMPLE_REPO
        assert _status(store, snapshot_id)["status"] == "running"
        with pytest.raises(snapshots.PipelineBusyError):
            snapshots.begin_snapshot(None)
    finally:
        snapshots.release_pipeline_slot()
    snapshots.begin_snapshot(None)
    snapshots.release_pipeline_slot()


def test_reprocess_failure_marks_failed(store, monkeypatch):
    store.objects[f"intelligence/raw/issues/snapshot={SNAP}/issues.jsonl"] = b""
    store.objects[STATUS_KEY] = json.dumps(
        {"snapshot_id": SNAP, "repo": SAMPLE_REPO, "fetched_at": "2026-01-01T00:00:00Z", "status": "complete"}
    ).encode()
    _stub_stages(monkeypatch, fail_in="classification")
    with pytest.raises(RuntimeError):
        snapshots.reprocess_snapshot(SNAP)
    assert _status(store)["status"] == "failed"


def test_an_llm_api_error_fails_the_snapshot_instead_of_the_parse_fallback(store, monkeypatch):
    # docs/RUNBOOK.md section 2: only an unparseable *reply* becomes `other` /
    # `parse_error`. When the Anthropic call itself keeps failing, call_llm
    # re-raises after its retries, classification does not catch it, and the
    # snapshot ends `failed` with no classifications written.
    from app.service import classification

    monkeypatch.setattr(ingestion, "fetch_issues", lambda repo, max_issues: ([_issue(1)], 4000))
    _stub_stages(monkeypatch)
    monkeypatch.setattr(snapshots, "run_classification", classification.run_classification)

    def api_down(*args, **kwargs):
        raise RuntimeError("anthropic: 529 overloaded")

    monkeypatch.setattr(classification, "call_llm", api_down)
    with pytest.raises(RuntimeError, match="overloaded"):
        snapshots.run_full_pipeline(SAMPLE_REPO, SNAP)
    assert _status(store)["status"] == "failed"
    assert not any("/classifications/" in key for key in store.objects)
