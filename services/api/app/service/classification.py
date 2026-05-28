import json
import logging

from app.config.intelligence import intel_settings
from app.repo.intelligence_storage import read_raw_snapshot, write_classifications
from app.repo.llm_client import call_llm
from app.service.prompts.classify import CLASSIFY_SYSTEM, build_classify_user
from app.types.classification import B2Role, ClassificationResult, IssueCategory

logger = logging.getLogger(__name__)


def _parse_classification(
    raw: str, issue_id: int, issue_number: int
) -> ClassificationResult:
    try:
        data = json.loads(raw)
        return ClassificationResult(
            issue_id=issue_id,
            issue_number=issue_number,
            category=IssueCategory(data.get("category", "other")),
            confidence=float(data.get("confidence", 0.5)),
            b2_role=B2Role(data.get("b2_role", "n/a")),
            spec_depth_score=float(data.get("spec_depth_score", 0)),
            model_id=intel_settings.llm_model,
            rationale=data.get("rationale", ""),
        )
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.warning("Classification parse failed issue=%d: %s", issue_number, e)
        return ClassificationResult(
            issue_id=issue_id,
            issue_number=issue_number,
            category=IssueCategory.OTHER,
            confidence=0.0,
            b2_role=B2Role.NOT_APPLICABLE,
            spec_depth_score=0.0,
            model_id=intel_settings.llm_model,
            rationale="parse_error",
        )


def run_classification(snapshot_id: str) -> dict:
    """Classify every issue in snapshot_id using the LLM.

    Returns cost metadata: {llm_input_tokens, llm_output_tokens, llm_cost_usd}.
    """
    issues, _ = read_raw_snapshot(snapshot_id)
    results = []
    total_input = 0
    total_output = 0

    for issue in issues:
        user_msg = build_classify_user(issue.title, issue.body or "")
        raw, inp, out = call_llm(CLASSIFY_SYSTEM, user_msg)
        result = _parse_classification(raw, issue.id, issue.number)
        results.append(result)
        total_input += inp
        total_output += out
        logger.info(
            "Classified issue=%d category=%s b2_role=%s depth=%.1f",
            issue.number, result.category, result.b2_role, result.spec_depth_score,
        )

    write_classifications(snapshot_id, results)

    cost = (
        total_input * intel_settings.llm_input_cost_per_1k / 1000
        + total_output * intel_settings.llm_output_cost_per_1k / 1000
    )
    logger.info(
        "Classification complete snapshot=%s issues=%d tokens_in=%d tokens_out=%d cost_usd=%.4f",
        snapshot_id, len(results), total_input, total_output, cost,
    )
    return {
        "llm_input_tokens": total_input,
        "llm_output_tokens": total_output,
        "llm_cost_usd": round(cost, 6),
    }
