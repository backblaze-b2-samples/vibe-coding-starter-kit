# Hermetic non-live verification

Issue: `backblaze-labs/demand-side-ai#427`

## Goal

Keep `pnpm verify` independent from real B2 while bounding runtime SDK waits.

## Plan

- Mock healthy and degraded health behavior at the repo boundary.
- Deny socket connections in the normal API suite.
- Add a separately gated live B2 test outside normal test discovery.
- Bound botocore connection/read waits and retries.
- Update existing command and reliability docs, then run `pnpm verify`.

## Non-goals

- A fake storage backend.
- Running a real B2 request while implementing this change.

## Result

- Normal API tests deny socket connections and health tests mock both states.
- The live B2 test is excluded from normal discovery and skips without opt-in.
- The shared botocore client has bounded waits and retries.
- `pnpm verify` passed with 182 API tests, 4 structure tests, 163 web tests,
  lint, typecheck, and the production build.
