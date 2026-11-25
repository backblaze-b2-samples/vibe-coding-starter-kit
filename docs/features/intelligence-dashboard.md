<!-- last_verified: 2026-11-25 -->
# Feature: Issue Intelligence Dashboard

## Purpose
Read-only views over the stored snapshots described in [intelligence.md](intelligence.md).

## Used By
- UI: `/intelligence` (latest complete snapshot), `/intelligence/snapshots` (history and status),
  `/intelligence/snapshots/{id}` (one report), `.../issues` (filterable list), `.../clusters/{clusterId}`
- API: the public `GET /intelligence/...` routes only

## UX States
- Loading skeletons; empty state pointing the operator at `pnpm intel:ingest`; error state; loaded.
- While a snapshot is `running` the list polls every 3 seconds.

## Canonical files
`apps/web/src/app/intelligence/`, `apps/web/src/components/intelligence/`,
`apps/web/src/lib/queries.ts` (`useSnapshots`, `useSnapshotReport`, ...).
