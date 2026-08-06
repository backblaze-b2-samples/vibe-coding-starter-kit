# Truthful endpoint and file-size guidance

Issue: `backblaze-labs/demand-side-ai#428`

## Goal

Make the detailed agent workflow and file-size invariant match the checks that
already exist.

## Plan

- Replace the incomplete endpoint list with a frontend/backend-only matrix.
- Scope the 300-line rule to authored backend application Python.
- Rename the structural test to expose that scope.
- Run the agent-doc guard and canonical verification.

## Non-goals

- New runtime behavior, dependencies, or policy documents.
- Reworking branding or production-boundary guidance already fixed on main.

## Result

- The endpoint matrix now covers frontend-consumed and backend-only routes.
- The 300-line rule and structural test name now state their backend Python scope.
- `pnpm verify` passed with 179 API tests, 4 structure tests, 163 web tests,
  109 agent-doc checks, lint, typecheck, and the production build.
