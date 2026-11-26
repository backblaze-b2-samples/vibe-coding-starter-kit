"""Storage adapter: shared B2 client, validated ids, JSONL embeddings."""

import inspect

import pytest

from app.repo import intelligence_storage as storage
from tests.fake_s3 import FakeS3


@pytest.fixture
def store(monkeypatch):
    fake = FakeS3()
    monkeypatch.setattr(storage, "get_s3_client", lambda: fake)
    return fake


def test_reuses_the_shared_s3_client_instead_of_building_its_own():
    from app.repo import b2_client

    source = inspect.getsource(storage)
    assert "import boto3" not in source and "boto3.client" not in source
    assert storage.get_s3_client is b2_client.get_s3_client


@pytest.mark.parametrize("bad", ["", "x", "../x", "20260101T000000Z/../../uploads", "20260101T000000Z/"])
def test_invalid_snapshot_ids_never_build_a_key(store, bad):
    with pytest.raises(ValueError):
        storage.read_embeddings(bad)
    with pytest.raises(ValueError):
        storage.write_embeddings(bad, [])
    assert store.objects == {} and store.put_calls == []


def test_embeddings_round_trip_as_jsonl(store):
    records = [
        {"issue_id": 1, "embedding": [0.5, 0.25], "model_id": "m", "content_hash": "h1"},
        {"issue_id": 2, "embedding": [1.0, 0.0], "model_id": "m", "content_hash": "h2"},
    ]
    storage.write_embeddings("20260101T000000Z", records)
    assert storage.read_embeddings("20260101T000000Z") == records
    assert any(k.endswith("embeddings.jsonl") for k in store.objects)


def test_list_snapshots_follows_pages_and_sorts_newest_first(store):
    for day in range(1, 6):
        snap = f"2026010{day}T000000Z"
        store.objects[f"intelligence/raw/issues/snapshot={snap}/status.json"] = (
            f'{{"snapshot_id":"{snap}","repo":"o/r","fetched_at":"2026-01-0{day}T00:00:00Z","status":"complete"}}'
        ).encode()
    store.page_size = 2
    result = storage.list_snapshots()
    assert [s.snapshot_id for s in result] == [f"2026010{d}T000000Z" for d in (5, 4, 3, 2, 1)]
