# B2 Storage Layout

## Existing layout (file upload)

```
<bucket>/
  uploads/           # direct file uploads (from /upload route)
    <filename>
```

## Intelligence pipeline layout

```
<bucket>/
  intelligence/
    raw/
      issues/
        snapshot=<YYYYMMDDTHHMMSSZ>/
          issues.jsonl          # one Issue JSON per line (full model)
          metadata.json         # IssueMetadata: repo, fetched_at, total_count, rate_remaining
          status.json           # SnapshotStatus: status, counts, pipeline_cost
    derived/
      embeddings/
        snapshot=<ts>/
          embeddings.parquet    # columns: issue_id, embedding (list<float>), model_id, content_hash
      classifications/
        snapshot=<ts>/
          classified.jsonl      # one ClassificationResult JSON per line
      clusters/
        snapshot=<ts>/
          clusters.json         # array of Cluster objects
          assignments.jsonl     # one ClusterAssignment JSON per line
      reports/
        snapshot=<ts>/
          report.json           # SnapshotReport (full dashboard payload)
```

## Design rationale

**Append-only.** Each run creates a new `snapshot=<ts>` directory. Existing snapshots are never modified. This makes the pipeline replayable: any stage can be re-run against an existing raw snapshot without re-running previous stages (`pnpm intel:reprocess <ts>`).

**Snapshot ID format.** `YYYYMMDDTHHMMSSZ` — UTC, compact, URL-safe (no colons), lexicographically sortable. Example: `20260528T143000Z`.

**`content_hash` on embeddings.** MD5 of `title + body`. Two snapshots taken close together will have mostly identical hashes — the embedding stage skips re-embedding matching hashes and reuses the existing vectors. This cuts cost significantly on frequent runs.

**JSONL for issues and classifications.** Streaming-friendly; easy to inspect with `jq`; appending a record doesn't require reading the whole file. Each line is a complete, self-contained JSON object.

**Parquet for embeddings.** Embedding vectors are large (1536 floats × N issues ≈ several MB). Parquet compresses well and supports columnar access — loading just the `content_hash` column for cache lookup is fast without reading all the vectors.

**`raw/` vs `derived/`.** The raw snapshot is the source of truth. All derived artifacts can be regenerated from it. If a derived stage fails or produces bad output, delete the derived prefix and reprocess — the raw data is untouched.

**Status file.** `status.json` in the raw snapshot directory tracks pipeline state (`running | ingested | complete | failed`) and cost metadata. It's written after each successful full run and after reprocess. The API reads this file to populate the snapshot list.

## Accessing artifacts

Use the B2 file browser (`/files`) to inspect snapshot artifacts. The intelligence prefix (`intelligence/`) will appear as a folder in the tree view.

For programmatic access, all read/write operations go through `repo/intelligence_storage.py`. Do not call `boto3` directly from service or runtime layers.
