import hashlib
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.types.base import ResponseModel

# Strict `owner/name`: GitHub login rules for the owner; the name may not start
# with a dot, so `.` and `..` can never appear as a path segment.
REPO_RE = re.compile(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})/[A-Za-z0-9_][A-Za-z0-9._-]{0,99}")
# Snapshot ids are minted as UTC timestamps and become part of a storage key.
SNAPSHOT_ID_PATTERN = r"^\d{8}T\d{6}Z$"
SNAPSHOT_ID_RE = re.compile(SNAPSHOT_ID_PATTERN)

SnapshotState = Literal["running", "ingested", "complete", "failed", "unknown"]


class IssueLabel(BaseModel):
    name: str
    color: str = ""


class Issue(BaseModel):
    id: int
    number: int
    title: str
    body: str | None = None
    state: str
    user_login: str
    labels: list[IssueLabel] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None = None
    html_url: str
    content_hash: str = ""

    @model_validator(mode="after")
    def compute_hash(self) -> "Issue":
        if not self.content_hash:
            text = (self.title or "") + (self.body or "")
            self.content_hash = hashlib.sha256(text.encode()).hexdigest()
        return self


class IssueMetadata(BaseModel):
    repo: str
    fetched_at: datetime
    total_count: int
    api_rate_remaining: int = 0


class SnapshotStatus(ResponseModel):
    snapshot_id: str
    repo: str
    fetched_at: datetime
    status: SnapshotState = "running"
    total_issues: int = 0
    open_issues: int = 0
    closed_issues: int = 0
    cluster_count: int = 0
    pipeline_cost: dict[str, float] = Field(default_factory=dict)
    # A fixed, generic message when status is "failed"; details stay in the logs.
    error: str = ""
