# Python 3.12 baseline

Issue: `backblaze-labs/demand-side-ai#426`

## Goal

Align local setup, the virtualenv, CI, lock provenance, and hosted runtime on
one Python 3.12 baseline without adding a version matrix.

## Plan

- Prefer Python 3.12 and treat newer 3.x versions as best effort.
- Validate existing virtualenv interpreters in setup and doctor.
- Align Ruff, CI, lock provenance, and existing docs on 3.12.
- Add regression checks for baseline consistency and selector behavior.
- Validate the committed lock in a clean Python 3.12 environment and run
  `pnpm contract:check` plus `pnpm verify`.

## Non-goals

- Refreshing application dependencies merely because newer releases exist.
- A multi-version CI matrix or support promise for every newer Python minor.

## Result

- Clean setup selected Python 3.12.13 and a second setup run reused it.
- Setup and doctor both rejected a Python 3.11 virtualenv with the documented
  recovery action.
- The existing pinned dependency set installed cleanly under 3.12 and passed
  `pip check`; no application dependencies were refreshed.
- `pnpm contract:check` reported no OpenAPI drift.
- `pnpm verify` passed on Python 3.12 with 181 API tests, 4 structure tests,
  163 web tests, 109 agent-doc checks, lint, typecheck, and the production build.
