from datetime import datetime

from pydantic import BaseModel, Field

from app.types.classification import B2Role, IssueCategory
from app.types.cluster import Cluster


class CategoryCount(BaseModel):
    category: IssueCategory
    count: int
    percentage: float = 0.0


class B2RoleCount(BaseModel):
    role: B2Role
    count: int


class WeeklyActivity(BaseModel):
    week: str
    cluster_id: str
    cluster_label: str
    created_count: int = 0
    updated_count: int = 0


class SpecDepthBucket(BaseModel):
    score_range: str
    count: int


class IssueSummary(BaseModel):
    issue_id: int
    issue_number: int
    title: str
    html_url: str
    category: IssueCategory
    b2_role: B2Role
    spec_depth_score: float
    cluster_id: str
    cluster_label: str


class SnapshotReport(BaseModel):
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
    pipeline_cost: dict = Field(default_factory=dict)
