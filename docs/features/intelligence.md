<!-- last_verified: 2026-11-25 -->
# Feature: Issue Intelligence

## Purpose
An optional, operator-run pipeline that reads the issues of one allow-listed GitHub
repository (by default this sample's own public repository), classifies and clusters
them, stores every stage in B2, and shows the result at `/intelligence`.

## Used By
- UI: `/intelligence`, `/intelligence/snapshots`, `/intelligence/snapshots/{id}` (read-only)
- API: `GET /intelligence/snapshots[/{id}[/issues|/clusters|/activity]]` (public reads),
  `POST /intelligence/snapshots` and `POST /intelligence/snapshots/{id}/reprocess` (operator only)
- CLI: `pnpm intel:ingest`, `intel:reprocess <id>`, `intel:list`, `intel:show <id>`

The main dashboard at `/` is unchanged; this feature lives under its own route.

## Access control
The pipeline spends GitHub quota, Anthropic tokens and B2 writes, so:
- The two POST routes are **off by default**. They work only when
  `INTELLIGENCE_ENABLED=true` and `INTELLIGENCE_ADMIN_TOKEN` is set, and every call
  must send `Authorization: Bearer <token>` (403 when disabled, 401 on a bad token).
  The browser UI never calls them, so no secret is shipped to the frontend.
- `repo` must be a strict `owner/name` and must be listed in `GITHUB_ALLOWED_REPOS`
  (default: this sample's public repository only). The check runs on every entry
  path (API and CLI) and the adapter validates the syntax again before building a URL.
- At most `MAX_ISSUES_PER_RUN` issues (default 200) are read per run; fetching stops
  at the page that exceeds it. One run at a time per process (409 otherwise).
- Snapshot ids must match `YYYYMMDDTHHMMSSZ` everywhere they reach a storage key.
- Issue text sent to the LLM is wrapped in delimiters and told to be treated as data.

## Flow
1. Ingest: fetch issues (open and closed, no pull requests) and write the raw snapshot.
2. Embed locally with `sentence-transformers/all-MiniLM-L6-v2`, pinned to a published
   revision (`config/intelligence.py`); vectors are cached by content hash.
3. Classify each issue with the configured Anthropic model (`LLM_MODEL`).
4. Cluster with HDBSCAN and label clusters with the LLM.
5. Analyse into one report. The snapshot status ends `complete`, or `failed` with a
   generic message (details stay in the server logs).

The snapshot id returned by the POST is the id the pipeline writes under.

## Storage layout
```
intelligence/
  raw/issues/snapshot=<id>/   issues.jsonl, metadata.json, status.json
  derived/embeddings/snapshot=<id>/embeddings.jsonl
  derived/classifications/snapshot=<id>/classified.jsonl
  derived/clusters/snapshot=<id>/clusters.json, assignments.jsonl
  derived/reports/snapshot=<id>/report.json
```

## Setup
The ML dependencies are optional and not in `requirements.lock`:
```
cd services/api
.venv/bin/pip install -c requirements.lock -r requirements-intelligence.txt
```
Then set the variables in `.env.example` (all commented out by default) and run
`pnpm intel:ingest`.

## Configuration
| Variable | Default | Purpose |
|---|---|---|
| `GITHUB_REPO` | this sample's public repo | target repository |
| `GITHUB_ALLOWED_REPOS` | same | comma-separated allow-list |
| `GITHUB_TOKEN` | empty | optional read-only token |
| `ANTHROPIC_API_KEY` | empty | classification and labels |
| `LLM_MODEL` | `claude-haiku-4-5-20251001` | Anthropic model |
| `MAX_ISSUES_PER_RUN` | 200 | hard cap per run |
| `INTELLIGENCE_ENABLED` / `INTELLIGENCE_ADMIN_TOKEN` | off / empty | enable the POST routes |

Each run logs a `pipeline_cost` dict (tokens and estimated USD, embeddings are local
and cost nothing). Rates are `LLM_INPUT_COST_PER_1K` / `LLM_OUTPUT_COST_PER_1K`.

## Edge cases
- Unparseable LLM reply: the issue is stored as `other` with confidence 0 (`parse_error`).
- More issues than the cap: the run fails before any LLM call.
- GitHub rate limit: waits at most twice, then fails.

## Canonical files
`services/api/app/service/snapshots.py`, `ingestion.py`, `runtime/intelligence.py`,
`repo/github_issues.py`, `repo/intelligence_storage.py`, `config/intelligence.py`.

## Verification
`services/api/tests/test_intelligence_routes.py`, `test_intelligence_pipeline.py`,
`test_github_issues.py`, `test_intelligence_prompts.py`, `test_intelligence_storage.py`,
`test_intelligence_services.py`; `apps/web/src/lib/intelligence-api.test.ts`.
