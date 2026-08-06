"""Regression checks for the committed API dependency resolution."""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
LOCK_PATH = API_ROOT / "requirements.lock"
INPUT_PATH = API_ROOT / "requirements.txt"
PYTHON_VERSION_PATH = API_ROOT / ".python-version"
EXACT_REQUIREMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*==[^=\s]+$")
INPUT_REQUIREMENT = re.compile(r"^([A-Za-z0-9][A-Za-z0-9_.-]*)(?:\[[^]]+\])?>=.+$")


def normalized_name(requirement: str) -> str:
    """Match pip distribution names case-insensitively across separators."""
    return re.split(r"==|>=", requirement, maxsplit=1)[0].replace("_", "-").lower()


def non_comment_lines(path: Path) -> list[str]:
    """Return dependency lines, excluding the lock's explanatory header."""
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def test_dependency_lock_contains_only_exact_requirements() -> None:
    """The committed resolution cannot silently regain floating constraints."""
    lock_lines = non_comment_lines(LOCK_PATH)

    assert lock_lines
    assert all(EXACT_REQUIREMENT.fullmatch(line) for line in lock_lines)


def test_dependency_lock_covers_every_direct_requirement() -> None:
    """The locked resolution includes the runtime and quality-tool inputs."""
    lock_names = {normalized_name(line) for line in non_comment_lines(LOCK_PATH)}
    matches = [INPUT_REQUIREMENT.fullmatch(line) for line in non_comment_lines(INPUT_PATH)]

    assert all(matches)
    input_names = {normalized_name(match.group(1)) for match in matches if match}
    assert input_names <= lock_names


def test_setup_and_ci_install_the_committed_lock() -> None:
    """Fresh local and CI environments use the same pinned resolution."""
    setup = (REPO_ROOT / "scripts" / "setup.mjs").read_text(encoding="utf-8")
    workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")

    assert "requirements.lock" in setup
    assert "pip install -r requirements.lock" in workflow


def test_python_312_baseline_is_consistent() -> None:
    """Runtime config, local tooling, CI, and lock provenance name one baseline."""
    runtime = (REPO_ROOT / "scripts" / "python-runtime.mjs").read_text(encoding="utf-8")
    setup = (REPO_ROOT / "scripts" / "setup.mjs").read_text(encoding="utf-8")
    doctor = (REPO_ROOT / "scripts" / "doctor.mjs").read_text(encoding="utf-8")
    workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(
        encoding="utf-8"
    )
    pyproject = (API_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    lock = LOCK_PATH.read_text(encoding="utf-8")

    assert PYTHON_VERSION_PATH.read_text(encoding="utf-8").strip() == "3.12"
    assert "REQUIRED_PYTHON_MINOR = 12" in runtime
    assert runtime.index('"python3.12"') < runtime.index('"python3"')
    assert "readPythonVersion(VENV_PYTHON)" in setup
    assert "readPythonVersion(VENV_PYTHON)" in doctor
    assert 'python-version: "3.12"' in workflow
    assert 'target-version = "py312"' in pyproject
    assert "Complete Python 3.12 resolution" in lock


def test_python_runtime_accepts_baseline_and_newer() -> None:
    """The selector rejects 3.11 while allowing the tested baseline and newer 3.x."""
    node = shutil.which("node")
    assert node is not None
    source = """
      import { isSupportedPython } from './scripts/python-runtime.mjs';
      const versions = [
        { major: 3, minor: 11 },
        { major: 3, minor: 12 },
        { major: 3, minor: 14 },
        { major: 4, minor: 0 },
      ];
      console.log(versions.map(isSupportedPython).join(','));
    """

    result = subprocess.run(
        [node, "--input-type=module", "--eval", source],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )

    assert result.stdout.strip() == "false,true,true,false"
