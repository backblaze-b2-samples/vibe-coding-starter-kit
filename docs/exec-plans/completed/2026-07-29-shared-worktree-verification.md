<!-- last_verified: 2026-07-29 -->
# Make shared-worktree verification predictable

## Goal

Make the credential-free `pnpm verify` gate safe and predictable when agents
run it concurrently, while documenting its normal timing, recovery path, and
the separately scoped live E2E workflow.

## Scope

- Establish and retain concise evidence for concurrent verification in the
  supported same-checkout and/or separate-worktree model.
- Isolate only the shared non-live outputs that demonstrably collide, or
  document the supported workflow if no isolation is needed.
- Keep `pnpm verify` credential-free and separate from E2E port/browser
  requirements.
- Document installing and running the tracked pre-commit hooks.
- Correct stale README context claims and add focused agent-doc checks only
  where they protect those claims.

## Steps

1. Baseline concurrent `pnpm verify` runs and identify any shared paths that
   conflict.
2. Document the separate-worktree workflow and narrow lock recovery required
   by the same-checkout evidence.
3. Update the canonical workflow, README, and agent documentation with the
   supported concurrency model, normal timing, slow-run recovery, pre-commit
   use, and E2E separation.
4. Repeat the concurrent experiment, run `pnpm check:agent-docs` and
   `pnpm verify`, then move this plan to `completed/`.

## Non-goals

- Add B2 credentials, browser installation, or E2E to the canonical gate.
- Change dev-server/E2E port behavior or add a second documentation rulebook.
- Modify application runtime behavior or dependency versions.

## Verification

- Same checkout baseline command: `(pnpm verify) & (pnpm verify) & wait`.
  Both commands reached the frontend build together; one exited with Next.js's
  `Unable to acquire lock at apps/web/.next/lock` error. Same-checkout
  concurrency is therefore intentionally unsupported.
- Separate-worktree command: `(cd <worktree-a> && pnpm verify) &
  (cd <worktree-b> && pnpm verify) & wait`. On 2026-07-29, a run in a separate
  temporary worktree and the unchanged main worktree both exited `0` (15s and
  17s, respectively), confirming separate-worktree concurrency is safe. (The
  temporary worktrees lived under `/private/tmp` and were removed after the run.)
- `pre-commit validate-config`
- `pnpm check:agent-docs` — passed (97 checks)
- `pnpm verify` — passed: 136 API tests, 158 web tests, lint, structure, and
  production build; no B2 credentials, browser installation, or E2E used.
