from fastapi import HTTPException

from app.repo import verify_repo
from app.types.verify import VerifyRunDetail, VerifyRunSummary


def list_runs() -> list[VerifyRunSummary]:
    raw = verify_repo.list_runs()
    return [VerifyRunSummary(**r) for r in raw]


def get_run(run_id: str) -> VerifyRunDetail:
    raw = verify_repo.get_run(run_id)
    if raw is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return VerifyRunDetail(**raw)
