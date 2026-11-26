import logging

from pydantic import ValidationError

from app.repo import verify_repo
from app.types.verify import VerifyRunDetail, VerifyRunSummary

logger = logging.getLogger(__name__)


class RunNotFoundServiceError(Exception):
    """Raised when a verification run does not exist (or its id is invalid)."""

    def __init__(self, run_id: str):
        self.detail = f"Run '{run_id}' not found"
        super().__init__(self.detail)


def list_runs() -> list[VerifyRunSummary]:
    runs: list[VerifyRunSummary] = []
    for raw in verify_repo.list_runs():
        try:
            runs.append(VerifyRunSummary(**raw))
        except (ValidationError, TypeError):
            logger.warning("Skipping a run summary that does not match the schema")
    return runs


def get_run(run_id: str) -> VerifyRunDetail:
    try:
        raw = verify_repo.get_run(run_id)
    except ValueError:
        raise RunNotFoundServiceError(run_id) from None
    if raw is None:
        raise RunNotFoundServiceError(run_id)
    return VerifyRunDetail(**raw)
