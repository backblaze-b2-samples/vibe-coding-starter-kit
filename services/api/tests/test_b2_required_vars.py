"""The B2 configuration contract in `app/config/b2_required_vars.json` is read
by two languages — `app/config/settings.py` and `scripts/doctor.mjs` — so
nothing in Python can catch a typo in it. These tests do.

Renaming a `Settings` field without renaming it in the JSON (or the reverse)
fails here rather than at runtime as a variable the server never validates.
"""

import json
from pathlib import Path

from app.config import PLACEHOLDER_VALUES, REQUIRED_B2_SETTINGS, Settings

CONTRACT_PATH = (
    Path(__file__).resolve().parents[1] / "app" / "config" / "b2_required_vars.json"
)
CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
ENTRIES = [*CONTRACT["required"], *CONTRACT["optional"]]


def test_every_declared_setting_exists_on_settings():
    fields = set(Settings.model_fields)
    missing = [entry["setting"] for entry in ENTRIES if entry["setting"] not in fields]

    assert not missing, (
        f"{CONTRACT_PATH.name} names settings that do not exist on Settings: "
        f"{missing}. Rename them together or the server validates nothing."
    )


def test_env_names_follow_the_standard_b2_prefix():
    assert [entry["env"] for entry in CONTRACT["required"]] == [
        "B2_APPLICATION_KEY_ID",
        "B2_APPLICATION_KEY",
        "B2_BUCKET_NAME",
        "B2_REGION",
    ]


def test_required_settings_are_derived_from_the_contract():
    expected_settings = tuple(
        (entry["setting"], entry["env"]) for entry in CONTRACT["required"]
    )
    expected_placeholders = frozenset(
        entry["placeholder"] for entry in CONTRACT["required"]
    )

    assert expected_settings == REQUIRED_B2_SETTINGS
    assert expected_placeholders == PLACEHOLDER_VALUES


def test_endpoint_url_is_derived_from_the_region():
    # A deliberately unreal region: a real B2 region slug in a non-doc source
    # file is exactly what the hardcoded-region check forbids.
    assert (
        Settings(b2_region="example-region-000").endpoint_url
        == "https://s3.example-region-000.backblazeb2.com"
    )
