from pydantic import BaseModel, Field


class Cluster(BaseModel):
    cluster_id: str
    label: str
    summary: str = ""
    issue_ids: list[int] = Field(default_factory=list)
    size: int = 0
    centroid_id: int | None = None


class ClusterAssignment(BaseModel):
    issue_id: int
    cluster_id: str
