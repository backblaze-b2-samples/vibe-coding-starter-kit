from fastapi import APIRouter

from app.service import verify as verify_service
from app.types.verify import VerifyRunDetail, VerifyRunSummary

router = APIRouter(prefix="/verify", tags=["verify"])


@router.get("/runs", response_model=list[VerifyRunSummary])
async def list_runs():
    return verify_service.list_runs()


@router.get("/runs/{run_id}", response_model=VerifyRunDetail)
async def get_run(run_id: str):
    return verify_service.get_run(run_id)
