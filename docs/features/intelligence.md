# Intelligence Pipeline

## Purpose

Ingest issues from a GitHub repository, classify and cluster them using LLM + embeddings, and assemble a dashboard payload that surfaces backlog themes, activity, spec quality, and B2 positioning.

## What it does / does not do

**Does:**
- Fetch all open + closed issues from a target GitHub repo
- Embed issues using OpenAI `text-embedding-3-small`
- Classify each issue: category, B2 role, spec depth score
- Cluster issues using HDBSCAN with LLM-generated cluster labels
- Assemble a `SnapshotReport` covering cluster breakdown, category distribution, B2 role distribution, activity timeline, and spec depth histogram
- Store every stage as append-only artifacts in B2 (replayable pipeline)
- Cache embeddings by `content_hash` to avoid re-embedding unchanged issues
- Log estimated pipeline cost at the end of each run

**Does not (v0):**
- Gap analysis (themes absent from the backlog)
- Multi-repo ingestion at runtime
- Scheduled/continuous ingestion
- Snapshot diff UI
- Cluster drift tracking across snapshots

## B2 Storage Layout

```
<bucket>/
  intelligence/
    raw/
      issues/
        snapshot=<YYYYMMDDTHHMMSSZ>/
          issues.jsonl          # one Issue JSON per line
          metadata.json         # {repo, fetched_at, total_count, api_rate_remaining}
          status.json           # SnapshotStatus (running/complete/failed)
    derived/
      embeddings/
        snapshot=<ts>/
          embeddings.parquet    # issue_id, embedding[], model_id, content_hash
      classifications/
        snapshot=<ts>/
          classified.jsonl      # ClassificationResult per line
      clusters/
        snapshot=<ts>/
          clusters.json         # [{cluster_id, label, summary, issue_ids, size, centroid_id}]
          assignments.jsonl     # {issue_id, cluster_id} per line
      reports/
        snapshot=<ts>/
          report.json           # SnapshotReport (full dashboard payload)
```

**Invariants:**
- Append-only. New runs create new snapshot directories; never edit in place.
- Snapshot IDs are `YYYYMMDDTHHMMSSZ` (UTC, URL-safe, sortable).
- `content_hash` is MD5 of `title + body`. Identical hash = skip re-embedding.
- Parquet stores embeddings as `list<float>` via pyarrow. Do not mix embedding models in one cluster run — the `model_id` column tracks which model produced each row.

## Pipeline Stages

### 1. Ingestion (`service/ingestion.py`)

**Input:** GitHub repo (`owner/name`)  
**Output:** `raw/issues/snapshot=<ts>/issues.jsonl` + `metadata.json`

Fetches all issues (open + closed) via GitHub REST API with pagination. Filters out pull requests (identified by `pull_request` key in GitHub response). Respects rate limits — backs off on `X-RateLimit-Remaining: 0`. Stores the full Issue model (not just selected fields) so future analyses can use any field.

Enforces `MAX_ISSUES_PER_RUN` — raises `ValueError` loudly rather than silently truncating.

### 2. Embeddings (`service/embeddings.py`)

**Input:** `raw/issues/snapshot=<ts>/issues.jsonl`  
**Output:** `derived/embeddings/snapshot=<ts>/embeddings.parquet`

Embeds `title + body` per issue. Caches by `content_hash` — reads any existing embedding file for the same snapshot and skips re-embedding issues whose hash is already present. Batches calls in groups of `EMBEDDING_BATCH_SIZE` (default 32).

Cost log line: `reused_embeddings=N`.

### 3. Classification (`service/classification.py`)

**Input:** `raw/issues/snapshot=<ts>/issues.jsonl`  
**Output:** `derived/classifications/snapshot=<ts>/classified.jsonl`

One LLM call per issue. Prompt template: `service/prompts/classify.py`. Extracts:
- `category`: `sample_app_spec | bug | enhancement | doc | meta | other`
- `confidence`: 0.0–1.0
- `b2_role`: `central | supporting | incidental | unclear | n/a`
- `spec_depth_score`: 0–10 heuristic (see rubric in prompt)
- `rationale`: one-sentence explanation

Parse failures produce a safe default (`OTHER` category, 0 confidence) and are logged.

### 4. Clustering (`service/clustering.py`)

**Input:** `derived/embeddings/...`, `raw/issues/...`  
**Output:** `derived/clusters/snapshot=<ts>/clusters.json` + `assignments.jsonl`

Uses scikit-learn HDBSCAN with `min_cluster_size` from config (default 3). Issues assigned label `-1` by HDBSCAN are placed in a synthetic `unclustered` cluster rather than forced into the nearest cluster.

For each real cluster: finds the 5 closest-to-centroid issues by cosine similarity, sends their titles to the LLM, and receives a 2–6 word label and 1–2 sentence summary. Prompt template: `service/prompts/cluster_label.py`.

### 5. Analysis (`service/analysis.py`)

**Input:** All derived stages  
**Output:** `derived/reports/snapshot=<ts>/report.json`

Assembles `SnapshotReport`: cluster list, category breakdown (with percentages), B2 role distribution, weekly activity timeline (by cluster), spec depth histogram (five 2-point buckets), top-N most detailed specs, top-N thinnest issues.

## LLM Prompt Templates

Prompts live in `services/api/app/service/prompts/`. They are Python modules that export string constants + builder functions. Keeping them in version control means prompt changes appear in git diffs.

- `prompts/classify.py` — classification prompt with category/role/depth rubric
- `prompts/cluster_label.py` — cluster label generation prompt

## Cost Model

Every pipeline run logs a structured cost line:

```json
{
  "event": "pipeline_cost",
  "embedding_tokens": 45000,
  "reused_embeddings": 120,
  "new_embeddings": 80,
  "embedding_cost_usd": 0.0009,
  "llm_input_tokens": 280000,
  "llm_output_tokens": 12000,
  "llm_cost_usd": 0.34,
  "llm_cluster_cost_usd": 0.002,
  "total_cost_usd": 0.3429
}
```

Cost per 1k tokens is configured in env vars (or `config/intelligence.py` defaults). The defaults are:
- `EMBEDDING_COST_PER_1K=0.00002` (text-embedding-3-small)
- `LLM_INPUT_COST_PER_1K=0.001` (claude-3-5-haiku)
- `LLM_OUTPUT_COST_PER_1K=0.005` (claude-3-5-haiku)

These are estimates for logging only — not billed amounts.

### Worked example

**Scenario:** First run against `backblaze-labs/demand-side-ai`, 168 issues (mix of open and closed), default settings, `claude-3-5-haiku-20241022` + `text-embedding-3-small`.

**Classification (168 LLM calls):**

The system prompt (`service/prompts/classify.py`) is ~350 tokens. Each user message is the issue title (~12 tokens) plus up to 1,200 characters of body (≈300 tokens on average for this repo). Average input per call: **~720 tokens**. JSON response (category + confidence + b2_role + spec_depth_score + rationale): **~80 tokens**.

| | Tokens | Rate | Cost |
|---|---|---|---|
| Input | 168 × 720 = 120,960 | $0.001 / 1k | $0.121 |
| Output | 168 × 80 = 13,440 | $0.005 / 1k | $0.067 |
| **Classification subtotal** | | | **$0.188** |

**Cluster labeling (~14 clusters × 1 LLM call each):**

Each call sends 5 representative issue titles (~150 tokens) plus the labeling system prompt (~100 tokens). Output is a 2–6 word label and 1–2 sentence summary (~60 tokens).

| | Tokens | Rate | Cost |
|---|---|---|---|
| Input | 14 × 250 = 3,500 | $0.001 / 1k | $0.004 |
| Output | 14 × 60 = 840 | $0.005 / 1k | $0.004 |
| **Clustering subtotal** | | | **$0.008** |

**Embeddings (168 issues, no cache hits on first run):**

Average issue is title + body ≈ 165 tokens after the 1,200-char body cap.

| | Tokens | Rate | Cost |
|---|---|---|---|
| Input | 168 × 165 = 27,720 | $0.00002 / 1k | $0.001 |
| **Embeddings subtotal** | | | **$0.001** |

**Total first run: ~$0.20**

**Second run (same issues, no new activity):** Embeddings are fully cached (`reused_embeddings=168`, `new_embeddings=0`). Classification re-runs (no cache at that layer). Cost is ~$0.196 — the embedding savings on this repo are modest (~$0.001) because haiku classification dominates.

**Update this section** with actuals from the first real run — replace the estimates with logged values from `pnpm intel:show <snapshot_id>` and note the date and issue count. The estimate above assumes average issue body length; actual cost will vary based on how verbose the issues are.

## Source Adapter Interface

The `repo/github_issues.py` module is the only concrete source adapter in v0. To add a new source (e.g., GitLab, Linear, Jira), implement a module with this interface:

```python
def fetch_issues(repo: str | None = None) -> tuple[list[Issue], int]:
    """Fetch issues from the source. Returns (issues, rate_remaining)."""
```

The `Issue` type in `app/types/issue.py` is the canonical model. New adapters must normalize to it. The service layer (`service/ingestion.py`) calls `fetch_issues` — swap the import to change the source. Do not add GitHub assumptions outside `repo/github_issues.py`.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GITHUB_REPO` | `backblaze-labs/demand-side-ai` | Target repo |
| `GITHUB_TOKEN` | (empty) | Fine-grained PAT, read-only public repo scope |
| `OPENAI_API_KEY` | (required) | For text-embedding-3-small |
| `ANTHROPIC_API_KEY` | (required) | For claude-3-5-haiku-20241022 |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI embedding model |
| `LLM_MODEL` | `claude-3-5-haiku-20241022` | Anthropic model for classification + labeling |
| `MAX_ISSUES_PER_RUN` | `500` | Hard cap; raises ValueError if exceeded |
| `CLUSTER_MIN_SIZE` | `3` | HDBSCAN min_cluster_size |
| `EMBEDDING_BATCH_SIZE` | `32` | Issues per embedding API call |

## Edge Cases

- **Rate limit hit**: GitHub client backs off up to 60s, then continues. Logged at WARNING level.
- **LLM parse failure**: Falls back to `category=other, confidence=0.0`. Logged at WARNING.
- **No embeddings for snapshot**: `run_clustering` raises RuntimeError immediately with a clear message.
- **Issue deleted upstream**: Next snapshot simply omits it. Previous snapshots are unchanged (append-only).
- **Empty body**: Classified on title only. Spec depth score will be low (0–2).
- **Duplicate content_hash**: Only the first is embedded; subsequent issues reuse that embedding. This can happen with auto-generated issues that share identical bodies.

## Adding a New Analysis Stage

1. Add a new `service/<stage>.py` that reads from existing derived artifacts and writes new ones
2. Add the new output path to `repo/intelligence_storage.py` (read/write pair)
3. Wire it into `service/snapshots.py` `run_full_pipeline` and `reprocess_snapshot`
4. Add the output data to `SnapshotReport` in `types/report.py` if it belongs on the dashboard
5. Update `analysis.py` if it contributes to the report assembly
6. Update this doc

Existing snapshots are safe — the new stage adds new keys to the derived prefix; it does not modify existing artifacts.

## Verification

```bash
# Run full pipeline against the real repo (requires API keys + B2 config)
pnpm intel:ingest

# Verify reuse logic: second run should log reused_embeddings=N
pnpm intel:ingest
grep reused_embeddings <output>

# Re-run derived stages only (no GitHub fetch)
pnpm intel:reprocess <snapshot_id>

# List all snapshots
pnpm intel:list

# Show report summary
pnpm intel:show <snapshot_id>

# Run structural tests
pnpm check:structure
```
