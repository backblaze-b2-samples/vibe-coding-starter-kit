# Intelligence Pipeline v0 — Execution Plan

**Status**: In progress  
**Started**: 2026-05-28

## What this builds

A B2 sample app that ingests issues from `backblaze-labs/demand-side-ai`, classifies and clusters them using embeddings + LLM, and surfaces backlog intelligence (themes, activity, spec depth, B2 role) via a Next.js dashboard backed by FastAPI.

Audience: Backblaze internal review of the demand-side-ai backlog, and as a generic repo-intelligence sample for external developers.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Embeddings provider | OpenAI `text-embedding-3-small` | No Anthropic embeddings API; cheapest viable model |
| LLM provider | Anthropic `claude-3-5-haiku-20241022` | Fast, cheap, good structured output |
| Clustering | scikit-learn HDBSCAN (v1.3+) | Native noise handling; no forced assignment |
| Storage format | JSONL (issues/classifications), parquet (embeddings), JSON (reports/clusters) | Parquet for vector storage; JSONL for streaming reads |
| Async pipeline | FastAPI BackgroundTasks + in-memory status dict | Simple for single-process v0; swap for Celery/worker in v1 |
| Snapshot ID | `YYYYMMDDTHHMMSSZ` compact UTC | URL-safe, sortable, human-readable |

## Acceptance criteria (from spec)

- [ ] `pnpm intel:ingest` runs end-to-end, produces complete snapshot in B2
- [ ] Dashboard at `/` shows intelligence overview for latest snapshot
- [ ] Clusters render with LLM-generated labels (at least one cluster ≥ size 3)
- [ ] All issues have category + b2_role
- [ ] Activity timeline renders with weekly buckets
- [ ] Second run reuses embeddings for unchanged issues (logged as `reused_embeddings: N`)
- [ ] `pnpm intel:reprocess <ts>` re-runs derived stages without GitHub fetch
- [ ] All structural tests pass (layering, file size, SDK containment, ESLint, ruff)
- [ ] Feature docs written

## File layout added

```
services/api/app/
  types/issue.py, classification.py, cluster.py, report.py
  config/intelligence.py
  repo/github_issues.py, embedding_client.py, llm_client.py, intelligence_storage.py
  service/ingestion.py, embeddings.py, classification.py, clustering.py, analysis.py, snapshots.py
  service/prompts/classify.py, cluster_label.py
  runtime/routes_intelligence.py, cli_intelligence.py

apps/web/src/
  app/intelligence/page.tsx
  app/intelligence/snapshots/page.tsx
  app/intelligence/snapshots/[id]/page.tsx
  app/intelligence/snapshots/[id]/issues/page.tsx
  app/intelligence/snapshots/[id]/clusters/[clusterId]/page.tsx
  components/intelligence/ (10 components)
```

## Open questions

- Optimal HDBSCAN `min_samples` for a ~200-issue backlog: test empirically on first run
- Embedding cache strategy across repos: `content_hash` is per-repo for now; consider global cache in v1
- Cost estimate for full `backblaze-labs/demand-side-ai` run: TBD after first run

## Out of scope for v0

- Scheduled/continuous ingestion
- Multi-repo support at runtime
- Gap analysis
- Snapshot diff UI (API has `/diff` endpoint; UI not implemented)
- Cluster drift tracking across snapshots
- Per-issue history (classification evolution)
- Export as markdown committed back to repo
