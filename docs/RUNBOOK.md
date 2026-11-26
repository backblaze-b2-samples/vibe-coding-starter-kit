<!-- last_verified: 2026-11-26 -->
# Runbook: Issue Intelligence Pipeline

What to do when an operator run of the optional issue-intelligence pipeline goes
wrong. How the pipeline works, its settings and its storage layout are in
[docs/features/intelligence.md](features/intelligence.md).

Every command below is run from the repository root with the optional
dependencies installed and the variables from `.env.example` set.

## 1. GitHub rate limit hit during ingestion

**What happens:** `fetch_issues()` in `repo/github_issues.py` reads
`X-RateLimit-Remaining` on every page. On a 403 with nothing remaining it logs
`GitHub rate limit hit; sleeping Ns`, sleeps until the reset (at most 60 seconds),
and retries. After two such waits it gives up with `GitHub rate limit exhausted`.

**Snapshot state:** the run already recorded the snapshot as `running`, so the
failure marks it `failed` (with a generic message; the detail is in the logs). No
issues are written: the raw snapshot is written only after every page is fetched.

**What to do:**
- Set `GITHUB_TOKEN` (a read-only token is enough). Authenticated requests get a
  far higher hourly limit than anonymous ones.
- Otherwise wait for the hourly reset and run `pnpm intel:ingest` again. A new run
  gets a new snapshot id; the failed one can stay or be deleted (section 3).

## 2. The LLM returns output that cannot be parsed

**What happens:** `_parse_classification()` in `service/classification.py`
catches the parse error, logs `Classification parse failed issue=<n>: ...`, and
stores the issue as category `other`, confidence 0, rationale `parse_error`. The
run continues; one bad reply does not fail the snapshot. The tokens are still
counted in the run's `pipeline_cost`.

**Finding the affected issues:** search the run's log for
`Classification parse failed`, or download
`intelligence/derived/classifications/snapshot=<id>/classified.jsonl` and look
for `"rationale":"parse_error"`.

**What to do:**
- A handful of failures: acceptable; check the next run.
- Many failures: the model may be unavailable or the prompt may be failing. An
  HTTP error from the Anthropic API ends in the same fallback, so check the log
  first. Then re-run the derived stages on the same raw issues:
  `pnpm intel:reprocess <snapshot_id>` (embeddings, classification, clustering
  and the report; no GitHub fetch).

## 3. Deleting a bad snapshot

A snapshot is these prefixes:

```
intelligence/raw/issues/snapshot=<id>/
intelligence/derived/embeddings/snapshot=<id>/
intelligence/derived/classifications/snapshot=<id>/
intelligence/derived/clusters/snapshot=<id>/
intelligence/derived/reports/snapshot=<id>/
```

Delete them with the B2 command-line tool, the Backblaze web console, or one file
at a time from the app's `/files` page. The snapshot list is built from the
`raw/issues/` prefixes, so once `raw/issues/snapshot=<id>/` is gone the snapshot
no longer appears in `pnpm intel:list` or at `/intelligence/snapshots`.

To keep good raw data but throw away bad derived output, delete only the
`derived/.../snapshot=<id>/` prefixes and run `pnpm intel:reprocess <id>`.

## 4. Correcting a wrong cluster label

Cluster labels are written by the LLM to
`derived/clusters/snapshot=<id>/clusters.json` and copied into
`derived/reports/snapshot=<id>/report.json`, which is what the dashboard reads.
There is no in-app editor.

- **Preferred:** `pnpm intel:reprocess <id>` re-clusters and asks for new labels.
  If a label is wrong on every run, the prompt is the problem: change
  `service/prompts/cluster_label.py` (prompt changes are reviewed like code) and
  reprocess.
- **One-off fix:** download `clusters.json` and `report.json`, change the cluster's
  `label` in both, and upload them back to the same keys. This is a manual
  override outside the pipeline; record it where the next operator will see it.
  Reload the dashboard page to see the change (it polls only while a snapshot is
  `running`).
