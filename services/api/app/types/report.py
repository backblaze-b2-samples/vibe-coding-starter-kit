from datetime import datetime

from pydantic import Field

from app.types.base import ResponseModel
from app.types.cluster import Cluster


# `category` and `b2_role` are plain strings here on purpose: they carry the
# values of IssueCategory / B2Role (types/classification.py), which stay enums
# for storage and validation, but `pnpm gen:api` does not emit enum schemas, so
# an enum-typed response field would reference a TypeScript type that is never
# generated.
class CategoryCount(ResponseModel):
    category: str
    count: int
    percentage: float = 0.0


class B2RoleCount(ResponseModel):
    role: str
    count: int


class WeeklyActivity(ResponseModel):
    week: str
    cluster_id: str
    cluster_label: str
    created_count: int = 0
    updated_count: int = 0


class SpecDepthBucket(ResponseModel):
    score_range: str
    count: int


class IssueSummary(ResponseModel):
    issue_id: int
    issue_number: int
    title: str
    html_url: str
    category: str
    b2_role: str
    spec_depth_score: float
    cluster_id: str
    cluster_label: str


class SnapshotReport(ResponseModel):
    snapshot_id: str
    repo: str
    generated_at: datetime
    total_issues: int = 0
    open_issues: int = 0
    closed_issues: int = 0
    clusters: list[Cluster] = Field(default_factory=list)
    category_breakdown: list[CategoryCount] = Field(default_factory=list)
    b2_role_distribution: list[B2RoleCount] = Field(default_factory=list)
    activity_timeline: list[WeeklyActivity] = Field(default_factory=list)
    spec_depth_histogram: list[SpecDepthBucket] = Field(default_factory=list)
    top_specs: list[IssueSummary] = Field(default_factory=list)
    thin_issues: list[IssueSummary] = Field(default_factory=list)
    pipeline_cost: dict[str, float] = Field(default_factory=dict)


class IssueListItem(ResponseModel):
    issue_id: int
    issue_number: int
    title: str
    html_url: str
    state: str
    category: str
    b2_role: str
    spec_depth_score: float
    cluster_id: str
    created_at: str


class IssueListResponse(ResponseModel):
    total: int
    offset: int
    limit: int
    items: list[IssueListItem]
