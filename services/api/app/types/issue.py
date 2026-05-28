import hashlib
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


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
            self.content_hash = hashlib.md5(text.encode()).hexdigest()
        return self


class IssueMetadata(BaseModel):
    repo: str
    fetched_at: datetime
    total_count: int
    api_rate_remaining: int = 0


class SnapshotStatus(BaseModel):
    snapshot_id: str
    repo: str
    fetched_at: datetime
    status: str = "running"
    total_issues: int = 0
    open_issues: int = 0
    closed_issues: int = 0
    cluster_count: int = 0
    pipeline_cost: dict = Field(default_factory=dict)
