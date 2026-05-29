from pydantic import BaseModel


class VerifyRunSummary(BaseModel):
    run_id: str
    timestamp: str
    total: int
    passed: int
    failed: int
    skipped: int
    duration: float
    git_sha: str


class VerifyRunDetail(VerifyRunSummary):
    results: dict
    screenshot_urls: list[str]
    trace_urls: list[str]
