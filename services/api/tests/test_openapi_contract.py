"""OpenAPI contract freshness checks."""

import json
from pathlib import Path

from main import app

REPO_ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = REPO_ROOT / "docs" / "api" / "openapi.json"


def test_checked_in_openapi_contract_is_current():
    expected = json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"

    assert CONTRACT_PATH.read_text(encoding="utf-8") == expected, (
        "docs/api/openapi.json is stale. Run `pnpm contract:export` "
        "and commit the result."
    )
