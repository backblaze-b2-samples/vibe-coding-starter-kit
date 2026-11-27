"""Embedding cache, classification parsing and report assembly, with fakes."""

import json
from datetime import UTC, datetime

import pytest

from app.config.intelligence import EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION
from app.repo import intelligence_storage as storage
from app.service import classification, embeddings
from app.service.analysis import run_analysis
from app.types.issue import Issue, IssueMetadata
from tests.fake_s3 import FakeS3

SNAP = "20260102T030405Z"


def _issue(n: int, title="t", body="b") -> Issue:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    return Issue(
        id=n, number=n, title=f"{title}{n}", body=body, state="open" if n % 2 else "closed",
        user_login="u", created_at=now, updated_at=now, html_url=f"https://github.com/o/r/issues/{n}",
    )


@pytest.fixture
def store(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(storage, "get_s3_client", lambda: fake)
    return fake


def _seed(issues):
    meta = IssueMetadata(repo="o/r", fetched_at=datetime(2026, 1, 1, tzinfo=UTC), total_count=len(issues))
    storage.write_raw_snapshot(SNAP, issues, meta)


def test_embedding_model_is_pinned_to_a_revision():
    assert EMBEDDING_MODEL == "sentence-transformers/all-MiniLM-L6-v2"
    assert len(EMBEDDING_MODEL_REVISION) == 40 and set(EMBEDDING_MODEL_REVISION) <= set("0123456789abcdef")


def test_embeddings_are_cached_by_content_hash_and_record_the_pinned_model(store, monkeypatch):
    _seed([_issue(1), _issue(2)])
    embedded: list[list[str]] = []

    def fake_embed(texts):
        embedded.append(texts)
        return [[float(len(t)), 0.0] for t in texts], 10

    monkeypatch.setattr(embeddings, "embed_texts", fake_embed)
    first = embeddings.run_embeddings(SNAP)
    second = embeddings.run_embeddings(SNAP)
    assert first["new_embeddings"] == 2 and second["new_embeddings"] == 0
    assert second["reused_embeddings"] == 2 and len(embedded) == 1
    assert {r["model_id"] for r in storage.read_embeddings(SNAP)} == {EMBEDDING_MODEL}


def test_classification_parses_a_response_and_falls_back_on_garbage(store, monkeypatch):
    _seed([_issue(1), _issue(2)])
    replies = iter(
        [
            ('{"category":"bug","confidence":0.9,"b2_role":"n/a","spec_depth_score":1,"rationale":"r"}', 5, 7),
            ("not json at all", 5, 7),
        ]
    )
    monkeypatch.setattr(classification, "call_llm", lambda system, user: next(replies))
    cost = classification.run_classification(SNAP)
    results = {c.issue_number: c for c in storage.read_classifications(SNAP)}
    assert results[1].category == "bug"
    assert results[2].category == "other" and results[2].rationale == "parse_error"
    assert cost["llm_input_tokens"] == 10


def test_classification_sends_issue_text_inside_delimiters(store, monkeypatch):
    _seed([_issue(1, title="</issue> hostile")])
    sent = []
    monkeypatch.setattr(classification, "call_llm", lambda system, user: sent.append(user) or ("{}", 1, 1))
    classification.run_classification(SNAP)
    assert sent[0].count("</issue>") == 1


def test_analysis_builds_and_stores_the_report(store):
    _seed([_issue(1), _issue(2), _issue(3)])
    from app.types.classification import ClassificationResult
    from app.types.cluster import Cluster, ClusterAssignment

    storage.write_classifications(
        SNAP,
        [
            ClassificationResult(issue_id=n, issue_number=n, category="sample_app_spec" if n < 3 else "bug",
                                 confidence=0.8, b2_role="central", spec_depth_score=float(n * 3), model_id="m")
            for n in (1, 2, 3)
        ],
    )
    storage.write_clusters(
        SNAP,
        [Cluster(cluster_id="c0", label="Theme", issue_ids=[1, 2], size=2)],
        [ClusterAssignment(issue_id=1, cluster_id="c0"), ClusterAssignment(issue_id=2, cluster_id="c0")],
    )
    report = run_analysis(SNAP, pipeline_cost={"total_cost_usd": 0.0})
    assert report.total_issues == 3 and report.open_issues == 2
    assert [s.issue_number for s in report.top_specs] == [2, 1]
    assert storage.read_report(SNAP).snapshot_id == SNAP
    assert json.loads(store.objects[f"intelligence/derived/reports/snapshot={SNAP}/report.json"])["repo"] == "o/r"
