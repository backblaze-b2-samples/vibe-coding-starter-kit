"""CLI entry points for the intelligence pipeline.

Usage (via pnpm scripts):
  pnpm intel:ingest            # full pipeline
  pnpm intel:ingest:raw        # ingestion only
  pnpm intel:reprocess <ts>    # re-run derived stages
  pnpm intel:list              # list snapshots
  pnpm intel:show <ts>         # print report summary
"""

import json
import logging
import sys

logger = logging.getLogger(__name__)


def _out(msg: str) -> None:
    sys.stdout.write(msg + "\n")


def _print_cost(cost_log: dict) -> None:
    _out(json.dumps({"event": "pipeline_cost", **cost_log}, indent=2))


def cmd_ingest(repo: str | None = None) -> None:
    from app.service.snapshots import run_full_pipeline

    snapshot_id, cost_log = run_full_pipeline(repo)
    _out(f"snapshot_id={snapshot_id}")
    _print_cost(cost_log)


def cmd_ingest_raw(repo: str | None = None) -> None:
    from app.service.ingestion import run_ingestion

    snapshot_id, metadata = run_ingestion(repo)
    _out(f"snapshot_id={snapshot_id} issues={metadata.total_count}")


def cmd_reprocess(snapshot_id: str) -> None:
    from app.service.snapshots import reprocess_snapshot

    sid, cost_log = reprocess_snapshot(snapshot_id)
    _out(f"snapshot_id={sid}")
    _print_cost(cost_log)


def cmd_list() -> None:
    from app.service.snapshots import get_all_snapshots

    snapshots = get_all_snapshots()
    if not snapshots:
        _out("No snapshots found.")
        return
    for s in snapshots:
        _out(f"{s.snapshot_id}  status={s.status}  issues={s.total_issues}  clusters={s.cluster_count}")


def cmd_show(snapshot_id: str) -> None:
    from app.repo.intelligence_storage import read_report

    report = read_report(snapshot_id)
    if report is None:
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


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    args = sys.argv[1:]
    if not args:
        _out(__doc__ or "")
        sys.exit(1)

    cmd = args[0]
    if cmd == "ingest":
        cmd_ingest(args[1] if len(args) > 1 else None)
    elif cmd == "ingest:raw":
        cmd_ingest_raw(args[1] if len(args) > 1 else None)
    elif cmd == "reprocess":
        if len(args) < 2:
            _out("Usage: reprocess <snapshot_id>")
            sys.exit(1)
        cmd_reprocess(args[1])
    elif cmd == "list":
        cmd_list()
    elif cmd == "show":
        if len(args) < 2:
            _out("Usage: show <snapshot_id>")
            sys.exit(1)
        cmd_show(args[1])
    else:
        _out(f"Unknown command: {cmd}")
        _out(__doc__ or "")
        sys.exit(1)


if __name__ == "__main__":
    main()
