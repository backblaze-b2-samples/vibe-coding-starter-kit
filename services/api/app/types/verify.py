import re

from pydantic import Field

from app.types.base import ResponseModel

# Run ids are minted by `scripts/upload-verify-run.ts` as `YYYY-MM-DD--<8 hex>`.
# One strict pattern, used by the route and the repo, so an id can never carry
# a slash or dot segment into a storage key.
RUN_ID_PATTERN = r"^\d{4}-\d{2}-\d{2}--[0-9a-f]{8}$"
RUN_ID_RE = re.compile(RUN_ID_PATTERN)


class VerifyRunSummary(ResponseModel):
    run_id: str = Field(pattern=RUN_ID_PATTERN)
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
