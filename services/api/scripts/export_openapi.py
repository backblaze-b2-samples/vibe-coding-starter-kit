"""Export the FastAPI OpenAPI contract deterministically."""

from __future__ import annotations

import argparse
import difflib
import json
import sys
from pathlib import Path
from typing import Any

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parents[1]
DEFAULT_TARGET = REPO_ROOT / "docs" / "api" / "openapi.json"
MAX_DIFF_LINES = 200


def write_stdout(message: str) -> None:
    sys.stdout.write(f"{message}\n")


def write_stderr(message: str) -> None:
    sys.stderr.write(f"{message}\n")


def load_contract() -> dict[str, Any]:
    """Import the FastAPI app and return its OpenAPI schema."""
    # Guarded: an unconditional insert grows sys.path on every call when this
    # module is imported and used more than once (e.g. from the contract test).
    if str(API_ROOT) not in sys.path:
        sys.path.insert(0, str(API_ROOT))
    from main import app

    return app.openapi()


def render_contract(contract: dict[str, Any]) -> str:
    """Render stable JSON for clean diffs and reproducible checks."""
    return json.dumps(contract, indent=2, sort_keys=True) + "\n"


def limited_diff(existing: str, generated: str, target: Path) -> str:
    diff = list(
        difflib.unified_diff(
            existing.splitlines(keepends=True),
            generated.splitlines(keepends=True),
            fromfile=str(target),
            tofile="generated OpenAPI",
        )
    )
    if len(diff) <= MAX_DIFF_LINES:
        return "".join(diff)
    shown = "".join(diff[:MAX_DIFF_LINES])
    hidden = len(diff) - MAX_DIFF_LINES
    return f"{shown}... diff truncated ({hidden} more lines)"


STALE_HINT = (
    "Run `pnpm contract:export` and commit the result. A FastAPI or Pydantic "
    "upgrade can also change the generated schema, so re-export after "
    "dependency bumps too."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export or check the checked-in FastAPI OpenAPI contract."
    )
    parser.add_argument(
        "target",
        nargs="?",
        type=Path,
        default=DEFAULT_TARGET,
        help=f"Contract JSON path (default: {DEFAULT_TARGET})",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Fail if the target file does not match the generated contract.",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="Print the generated contract instead of writing a file.",
    )
    args = parser.parse_args()
    if args.check and args.stdout:
        parser.error("--check and --stdout cannot be combined")
    return args


def main() -> int:
    args = parse_args()
    target = args.target.resolve()

    # Checked before importing the app: a missing artifact needs no schema
    # generation, and the actionable message should not wait on the import.
    if args.check and not target.exists():
        write_stderr(f"OpenAPI contract missing at {target}. {STALE_HINT}")
        return 1

    generated = render_contract(load_contract())

    if args.stdout:
        sys.stdout.write(generated)
        return 0

    if args.check:
        existing = target.read_text(encoding="utf-8")
        if existing == generated:
            write_stdout(f"OpenAPI contract is current: {target}")
            return 0

        write_stderr(
            f"OpenAPI contract is out of date: {target}\n"
            f"{STALE_HINT}\n"
            f"{limited_diff(existing, generated, target).rstrip()}"
        )
        return 1

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(generated, encoding="utf-8")
    write_stdout(f"Wrote OpenAPI contract: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
