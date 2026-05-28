<!-- last_verified: 2026-05-28 -->
# Runbook: Intelligence Pipeline

Operational guidance for when things go sideways. Written before the first bad day, not during it.

---

## 1. GitHub rate limit hit mid-ingestion

**What actually happens:** `fetch_issues()` checks `X-RateLimit-Remaining` on every response. On a 403 with remaining=0, it sleeps `min(reset_wait, 60)` seconds and retries. It does **not** fail — it loops until the reset window passes. For a large repo near the unauthenticated limit (60 req/hr), this can block the process for up to an hour.

**Snapshot state:** Nothing is written to B2 until all pages are fetched. If you kill the process mid-ingestion, no snapshot is created — `pnpm intel:list` will not show a partial entry. There is no partial/corrupt state to clean up.

**What to do:**

*If the process is blocking (sleeping through rate limit):*
- With a `GITHUB_TOKEN`, the rate limit is 5000 req/hr vs 60 req/hr unauthenticated. Set one in `.env` and restart.
- Unauthenticated: wait for the reset (GitHub resets hourly). The process will resume automatically.
- If you killed the process: just re-run `pnpm intel:ingest`. No cleanup needed.

*If you're frequently hitting the rate limit:*
- Add `GITHUB_TOKEN` to `.env` (a read-only fine-grained PAT scoped to public repo read is enough).
- Reduce run frequency — the embedding cache means re-runs are cheap, but not free.

*How to tell you were rate-limited:* Look for `WARNING ... GitHub rate limit hit; sleeping Xs` in the log output.

---

## 2. LLM returns malformed output during classification

**What actually happens:** `_parse_classification()` catches `json.JSONDecodeError`, `ValueError`, and `KeyError`. On any parse failure, the issue is assigned `category=other, confidence=0.0, b2_role=n/a, spec_depth_score=0.0, rationale="parse_error"`. The run continues — a parse failure on one issue does not abort the run.

**Snapshot state:** The snapshot completes normally. Issues with parse failures appear in the dashboard as "other" category with zero confidence. The pipeline cost log will show the full token count (you paid for the call even if the response was malformed).

**How to identify affected issues:**

```bash
# Find parse failures in the log output (API) or terminal (CLI)
grep "Classification parse failed" <log>

# Or inspect the classified.jsonl in B2
# Download: intelligence/derived/classifications/snapshot=<ts>/classified.jsonl
# Then:
grep '"rationale": "parse_error"' classified.jsonl
```

**What to do:**

*If a small number of issues (< 5%) have parse errors:* Acceptable. The LLM occasionally produces malformed JSON on edge cases (very long bodies, unusual characters). Note the issue numbers and check the next snapshot.

*If a large fraction failed:* The model may have drifted, or the prompt is hitting a guardrail. Check:
1. The raw LLM response in your API logs (logged at WARNING level with the error)
2. Whether the model was temporarily unavailable — an HTTP error from Anthropic also triggers the fallback
3. Reprocess the snapshot: `pnpm intel:reprocess <snapshot_id>` — this re-runs classification fresh

*If you want to reprocess classification only (not all stages):* There is no single-stage CLI command in v0. `intel:reprocess` re-runs embeddings + classification + clustering + analysis. For a pure reclassification, run `intel:ingest` again (full new snapshot) — the embedding cache means you won't re-pay for embeddings on unchanged issues.

---

## 3. Deleting a bad snapshot from B2

A snapshot produces garbage if the LLM was behaving poorly, you were testing against a wrong repo, or a pipeline bug corrupted the report.

**The snapshot consists of these B2 prefixes:**

```
intelligence/raw/issues/snapshot=<ts>/
intelligence/derived/embeddings/snapshot=<ts>/
intelligence/derived/classifications/snapshot=<ts>/
intelligence/derived/clusters/snapshot=<ts>/
intelligence/derived/reports/snapshot=<ts>/
```

**Option 1: B2 CLI (recommended for full cleanup)**

```bash
# Substitute your bucket name and snapshot ID
b2 rm --recursive b2://your-bucket/intelligence/raw/issues/snapshot=20260528T143000Z/
b2 rm --recursive b2://your-bucket/intelligence/derived/embeddings/snapshot=20260528T143000Z/
b2 rm --recursive b2://your-bucket/intelligence/derived/classifications/snapshot=20260528T143000Z/
b2 rm --recursive b2://your-bucket/intelligence/derived/clusters/snapshot=20260528T143000Z/
b2 rm --recursive b2://your-bucket/intelligence/derived/reports/snapshot=20260528T143000Z/
```

Or with the AWS CLI (which also works against B2's S3-compatible API):

```bash
aws s3 rm --recursive s3://your-bucket/intelligence/raw/issues/snapshot=20260528T143000Z/ \
  --endpoint-url https://<your-b2-endpoint>
# Repeat for each derived prefix
```

**Option 2: B2 web console**
Open the bucket in the [Backblaze console](https://secure.backblaze.com/b2_buckets.htm), navigate to the `intelligence/` prefix, and delete files under the snapshot directory. For more than a handful of files, the CLI is faster.

**Option 3: File browser in the app (`/files`)**
Navigate to the snapshot prefix in the tree view and delete individual files. Practical for removing a single bad report without touching raw data.

**After deletion:** The snapshot will no longer appear in `pnpm intel:list` or the snapshots UI (the list is built from `status.json` files). No other cleanup needed.

**Note on partial deletes:** If you delete only the derived stages (embeddings/classifications/clusters/reports) but keep `raw/`, you can reprocess the snapshot cleanly: `pnpm intel:reprocess <ts>`. This is useful when the raw data was good but a derived stage produced garbage.

---

## 4. Manually correcting a wrong cluster label

The LLM-generated cluster labels are stored in `clusters.json` and embedded in `report.json`. There is no in-app UI for editing them.

**Option A: Force a new label via reprocess (preferred)**

```bash
pnpm intel:reprocess <snapshot_id>
```

This re-runs clustering from scratch — HDBSCAN re-assigns issues, and the LLM generates new labels. The cluster boundaries may shift slightly (HDBSCAN is deterministic given the same embeddings, so they'll be identical if embeddings didn't change). You'll get a new LLM labeling call.

If the label is consistently wrong across reprocesses, the issue is likely the prompt. Edit `service/prompts/cluster_label.py` — the change will appear in the git diff for review — then reprocess.

**Option B: Patch the JSON in B2 directly (for a one-off fix)**

1. Download `intelligence/derived/clusters/snapshot=<ts>/clusters.json` via the file browser or B2 CLI
2. Edit the `label` (and optionally `summary`) for the cluster in question
3. Upload it back to the same path, overwriting the file
4. Download `intelligence/derived/reports/snapshot=<ts>/report.json`
5. Find the cluster entry in `report.json` (search for the cluster_id) and update the label there too
6. Upload the modified `report.json` back

The dashboard reads from `report.json`, so step 5–6 is what makes the label change visible. This is a manual override outside the pipeline contract — document it in a comment or commit message so the next person knows the label was hand-edited.

**After patching:** Hard-refresh the dashboard (`Cmd+Shift+R`) to clear TanStack Query's cache, or wait for the 3-second polling interval.
