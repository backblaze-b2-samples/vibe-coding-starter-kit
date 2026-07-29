<!-- last_verified: 2026-07-28 -->
# Lock Python dependencies for reproducible verification

## Goal

Commit a complete Python 3.11 dependency resolution and make local setup and CI
install it, so OpenAPI contract checks only change after an intentional
dependency update.

## Scope

- Keep `services/api/requirements.txt` as the human-edited minimum-version
  input.
- Add a fully pinned `services/api/requirements.lock` for Python 3.11.
- Point local setup and the API CI job at the lock.
- Document intentional lock refresh and contract-export steps.
- Remove the now-resolved floating-dependency contract item from the tech-debt
  tracker.

## Steps

1. Resolve the current inputs in a clean Python 3.11 environment and commit the
   full exact-version result.
2. Update setup and CI to install that result without dependency upgrades.
3. Update the API-contract and setup documentation with the normal update and
   recovery workflows.
4. Validate a clean locked environment, contract stability, and the canonical
   verification suite.

## Non-goals

- Change runtime behavior, Python support policy, or the pnpm lock workflow.
- Add a container-only setup path or dependency-update bot.

## Verification

- Installed `requirements.lock` in a clean Python 3.11 virtual environment and
  passed `pip check`.
- `pnpm contract:check` passed without OpenAPI changes.
- `pnpm verify` passed.
