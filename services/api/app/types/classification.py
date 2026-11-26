from enum import StrEnum

from pydantic import BaseModel, Field


class IssueCategory(StrEnum):
    SAMPLE_APP_SPEC = "sample_app_spec"
    BUG = "bug"
    ENHANCEMENT = "enhancement"
    DOC = "doc"
    META = "meta"
    OTHER = "other"


class B2Role(StrEnum):
    CENTRAL = "central"
    SUPPORTING = "supporting"
    INCIDENTAL = "incidental"
    UNCLEAR = "unclear"
    NOT_APPLICABLE = "n/a"


class ClassificationResult(BaseModel):
    issue_id: int
    issue_number: int
    category: IssueCategory
    confidence: float = Field(ge=0.0, le=1.0)
    b2_role: B2Role
    spec_depth_score: float = Field(ge=0.0, le=10.0)
    model_id: str
    rationale: str = ""
