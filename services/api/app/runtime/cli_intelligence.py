"""Operator CLI for the intelligence pipeline (run from the repo root).

  pnpm intel:ingest [owner/name]   # full pipeline for an allow-listed repo
  pnpm intel:reprocess <id>        # re-run derived stages on a stored snapshot
  pnpm intel:list                  # list snapshots
  pnpm intel:show <id>             # print a report summary

The same allow-list and issue cap as the API apply. Needs the B2 variables,
GITHUB_TOKEN (optional) and ANTHROPIC_API_KEY in the repo-root `.env`, and the
optional ML dependencies (services/api/requirements-intelligence.txt).
"""

import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / ".env")

from app.service.ingestion import RepoNotAllowedError  # noqa: E402
from app.service.issue_listing import get_report  # noqa: E402
from app.service.snapshots import (  # noqa: E402
    SnapshotNotFoundServiceError,
    get_all_snapshots,
    reprocess_snapshot,
    run_full_pipeline,
)
from app.types.issue import SNAPSHOT_ID_RE  # noqa: E402


def _out(msg: str) -> None:
    sys.stdout.write(msg + "\n")


def _print_cost(cost_log: dict) -> None:
    _out(json.dumps({"event": "pipeline_cost", **cost_log}, indent=2))


def cmd_ingest(repo: str | None = None) -> None:
    snapshot_id, cost_log = run_full_pipeline(repo)
    _out(f"snapshot_id={snapshot_id}")
    _print_cost(cost_log)


def cmd_reprocess(snapshot_id: str) -> None:
    sid, cost_log = reprocess_snapshot(snapshot_id)
    _out(f"snapshot_id={sid}")
    _print_cost(cost_log)


def cmd_list() -> None:
    snapshots = get_all_snapshots()
    if not snapshots:
        _out("No snapshots found.")
        return
    for s in snapshots:
        _out(f"{s.snapshot_id}  status={s.status}  issues={s.total_issues}  clusters={s.cluster_count}")


def cmd_show(snapshot_id: str) -> None:
    try:
        report = get_report(snapshot_id)
    except SnapshotNotFoundServiceError:
        _out(f"No report found for snapshot {snapshot_id}")
        sys.exit(1)
    _out(f"Snapshot:  {report.snapshot_id}")
    _out(f"Repo:      {report.repo}")
    _out(f"Issues:    {report.total_issues} ({report.open_issues} open, {report.closed_issues} closed)")
    _out(f"Clusters:  {len(report.clusters)}")
    _out("\nCategory breakdown:")
    for cat in report.category_breakdown:
        _out(f"  {cat.category:<20} {cat.count:>4}  ({cat.percentage:.1f}%)")
    _out("\nTop clusters:")
    for cluster in sorted(report.clusters, key=lambda c: c.size, reverse=True)[:5]:
        _out(f"  [{cluster.cluster_id}] {cluster.label:<35} size={cluster.size}")
    if report.pipeline_cost:
        _out(f"\nPipeline cost: ${report.pipeline_cost.get('total_cost_usd', 0):.4f} USD")


def _need_snapshot_id(args: list[str]) -> str:
    if len(args) < 2 or not SNAPSHOT_ID_RE.fullmatch(args[1]):
        _out(f"Usage: {args[0]} <snapshot_id>  (for example 20260101T000000Z)")
        sys.exit(1)
    return args[1]


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    args = sys.argv[1:]
    if not args:
        _out(__doc__ or "")
        sys.exit(1)

    cmd = args[0]
    try:
        if cmd == "ingest":
            cmd_ingest(args[1] if len(args) > 1 else None)
        elif cmd == "reprocess":
            cmd_reprocess(_need_snapshot_id(args))
        elif cmd == "list":
            cmd_list()
        elif cmd == "show":
            cmd_show(_need_snapshot_id(args))
        else:
            _out(f"Unknown command: {cmd}")
            _out(__doc__ or "")
            sys.exit(1)
    except RepoNotAllowedError as e:
        _out(f"Refused: {e.detail}")
        sys.exit(2)


if __name__ == "__main__":
    main()
