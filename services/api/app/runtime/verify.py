from typing import Annotated

from fastapi import APIRouter, HTTPException, Path

from app.service.verify import RunNotFoundServiceError, get_run, list_runs
from app.types.verify import RUN_ID_PATTERN, VerifyRunDetail, VerifyRunSummary

router = APIRouter(prefix="/verify", tags=["verify"])

# Sync handlers on purpose, like runtime/files.py: the chain is blocking boto3,
# so Starlette runs them in its threadpool instead of stalling the event loop.
# Unauthenticated like the rest of the API (see docs/SECURITY.md).


@router.get("/runs", response_model=list[VerifyRunSummary])
def list_verify_runs() -> list[VerifyRunSummary]:
    return list_runs()


@router.get("/runs/{run_id}", response_model=VerifyRunDetail)
def get_verify_run(
    run_id: Annotated[str, Path(pattern=RUN_ID_PATTERN)],
) -> VerifyRunDetail:
    try:
        return get_run(run_id)
    except RunNotFoundServiceError as e:
        raise HTTPException(status_code=404, detail=e.detail) from None
