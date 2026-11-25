"""Tests for the verification-run endpoints (/verify/runs).

The B2 client is replaced by a small in-memory fake at the repo boundary, so
these run offline and can assert how the repo talks to B2 (pagination, request
counts, presign lifetime), not only what the routes return.
"""

import json
from io import BytesIO

import pytest
from botocore.exceptions import ClientError

from app.repo import verify_repo

RUN_A = "2026-05-28--abc12345"
RUN_B = "2026-05-27--def67890"


def _summary(run_id: str, ts: str) -> dict:
    return {
        "run_id": run_id,
        "timestamp": ts,
        "total": 3,
        "passed": 3,
        "failed": 0,
        "skipped": 0,
        "duration": 1.5,
        "git_sha": "abc1234",
    }


class FakeS3:
    """Just enough of the S3 client for verify_repo."""

    def __init__(self, objects: dict[str, bytes], page_size: int = 1000):
        self.objects = objects
        self.page_size = page_size
        self.get_calls: list[str] = []
        self.list_calls: list[dict] = []
        self.presign_calls: list[dict] = []

    def list_objects_v2(self, **kwargs):
        self.list_calls.append(kwargs)
        prefix = kwargs.get("Prefix", "")
        delimiter = kwargs.get("Delimiter")
        start = int(kwargs.get("ContinuationToken", 0))
        entries: list[tuple[str, str]] = []  # (kind, value)
        seen: set[str] = set()
        for key in sorted(self.objects):
            if not key.startswith(prefix):
                continue
            rest = key[len(prefix):]
            if delimiter and delimiter in rest:
                common = prefix + rest.split(delimiter, 1)[0] + delimiter
                if common not in seen:
                    seen.add(common)
                    entries.append(("prefix", common))
            else:
                entries.append(("key", key))
        page = entries[start : start + self.page_size]
        truncated = start + self.page_size < len(entries)
        response: dict = {
            "CommonPrefixes": [{"Prefix": v} for k, v in page if k == "prefix"],
            "Contents": [{"Key": v} for k, v in page if k == "key"],
            "IsTruncated": truncated,
        }
        if truncated:
            response["NextContinuationToken"] = str(start + self.page_size)
        return response

    def get_object(self, Bucket, Key):
        self.get_calls.append(Key)
        if Key not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return {"Body": BytesIO(self.objects[Key])}

    def generate_presigned_url(self, op, Params, ExpiresIn):
        self.presign_calls.append({"op": op, "Params": Params, "ExpiresIn": ExpiresIn})
        return f"https://signed.example/{Params['Key']}?exp={ExpiresIn}"


def _store(*runs: tuple[str, str]) -> dict[str, bytes]:
    objects: dict[str, bytes] = {}
    for run_id, ts in runs:
        objects[f"verification-runs/{run_id}/summary.json"] = json.dumps(
            _summary(run_id, ts)
        ).encode()
        objects[f"verification-runs/{run_id}/results.json"] = b"{}"
    return objects


@pytest.fixture(autouse=True)
def fresh_cache():
    verify_repo._reset_cache()
    yield
    verify_repo._reset_cache()


@pytest.fixture
def fake(monkeypatch):
    def install(objects: dict[str, bytes], page_size: int = 1000) -> FakeS3:
        client = FakeS3(objects, page_size)
        monkeypatch.setattr(verify_repo, "get_s3_client", lambda: client)
        return client

    return install


@pytest.mark.asyncio
async def test_list_runs_newest_first(client, fake):
    fake(_store((RUN_B, "2026-05-27T09:30:00Z"), (RUN_A, "2026-05-28T10:04:00Z")))
    response = await client.get("/verify/runs")
    assert response.status_code == 200
    assert [r["run_id"] for r in response.json()] == [RUN_A, RUN_B]


@pytest.mark.asyncio
async def test_list_runs_follows_continuation_tokens(client, fake):
    """More run prefixes than one page: every page must be read."""
    runs = [(f"2026-05-{day:02d}--{day:08x}", f"2026-05-{day:02d}T00:00:00Z") for day in range(1, 8)]
    s3 = fake(_store(*runs), page_size=2)
    response = await client.get("/verify/runs")
    assert response.status_code == 200
    assert len(response.json()) == 7
    assert any("ContinuationToken" in call for call in s3.list_calls)


@pytest.mark.asyncio
async def test_list_runs_reads_only_the_newest_runs(client, fake, monkeypatch):
    monkeypatch.setattr(verify_repo, "MAX_RUNS", 3)
    runs = [(f"2026-05-{day:02d}--{day:08x}", f"2026-05-{day:02d}T00:00:00Z") for day in range(1, 8)]
    s3 = fake(_store(*runs))
    response = await client.get("/verify/runs")
    assert [r["run_id"][:10] for r in response.json()] == ["2026-05-07", "2026-05-06", "2026-05-05"]
    assert len(s3.get_calls) == 3


@pytest.mark.asyncio
async def test_list_runs_is_cached_between_requests(client, fake):
    """A second request must not fetch every summary from B2 again."""
    s3 = fake(_store((RUN_A, "2026-05-28T10:04:00Z"), (RUN_B, "2026-05-27T09:30:00Z")))
    await client.get("/verify/runs")
    first = len(s3.get_calls)
    await client.get("/verify/runs")
    assert first == 2
    assert len(s3.get_calls) == first


@pytest.mark.asyncio
async def test_list_runs_skips_malformed_summary(client, fake):
    objects = _store((RUN_A, "2026-05-28T10:04:00Z"))
    objects[f"verification-runs/{RUN_B}/summary.json"] = b"{not json"
    fake(objects)
    response = await client.get("/verify/runs")
    assert [r["run_id"] for r in response.json()] == [RUN_A]


@pytest.mark.asyncio
async def test_get_run_returns_detail_with_short_lived_urls(client, fake):
    objects = _store((RUN_A, "2026-05-28T10:04:00Z"))
    objects[f"verification-runs/{RUN_A}/screenshots/a/one.png"] = b"x"
    objects[f"verification-runs/{RUN_A}/traces/t.zip"] = b"x"
    s3 = fake(objects)
    response = await client.get(f"/verify/runs/{RUN_A}")
    assert response.status_code == 200
    body = response.json()
    assert len(body["screenshot_urls"]) == 1
    assert len(body["trace_urls"]) == 1
    assert [c["ExpiresIn"] for c in s3.presign_calls] == [600, 600]


@pytest.mark.asyncio
async def test_get_run_lists_every_page_of_artifacts(client, fake):
    objects = _store((RUN_A, "2026-05-28T10:04:00Z"))
    for n in range(5):
        objects[f"verification-runs/{RUN_A}/screenshots/s{n}.png"] = b"x"
    fake(objects, page_size=2)
    body = (await client.get(f"/verify/runs/{RUN_A}")).json()
    assert len(body["screenshot_urls"]) == 5


@pytest.mark.asyncio
async def test_get_run_unknown_id_is_404(client, fake):
    fake(_store((RUN_A, "2026-05-28T10:04:00Z")))
    response = await client.get(f"/verify/runs/{RUN_B}")
    assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_id",
    [
        "not-a-run",
        "..%2F..%2Fuploads%2Fsecret",
        "2026-05-28--ABCDEF12",
        "2026-05-28--abc1234",
        "2026-05-28--abc123456",
        "2026-05-28--abc12345%2Fscreenshots",
        "2026-5-28--abc12345",
    ],
)
async def test_run_id_must_match_the_strict_pattern(client, fake, bad_id):
    """A malformed id is rejected before any key is built or any B2 call made."""
    s3 = fake(_store((RUN_A, "2026-05-28T10:04:00Z")))
    response = await client.get(f"/verify/runs/{bad_id}")
    assert response.status_code in (404, 422)
    assert s3.get_calls == []
    assert s3.list_calls == []


def test_repo_rejects_a_malformed_run_id_directly(fake):
    s3 = fake(_store((RUN_A, "2026-05-28T10:04:00Z")))
    with pytest.raises(ValueError):
        verify_repo.get_run("../uploads")
    assert s3.get_calls == []
