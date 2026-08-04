# Unify VCSK Identity and API Discovery

## Goal

Make Vibe Coding Starter Kit the canonical identity across the shipped web app,
local FastAPI metadata, checked-in OpenAPI contract, and public documentation.
Clarify when the template is appropriate, how it is maintained, and the
official no-SLA boundary without weakening its documented engineering quality.

## Scope

1. Update the frontend identity constants and FastAPI metadata.
2. Add regression coverage for the canonical web and API identity.
3. Re-export the OpenAPI artifact with the deterministic repository command.
4. Update README and product maturity language, selection guidance, public
   discovery links, maintenance/support routes, and the no-SLA boundary.
5. Remove the resolved identity mismatch from the tech-debt tracker.

## Non-goals

- Change the Dashboard, Upload, Files, Settings, or starter contract.
- Add or deploy a hosted public API.
- Add audits, benchmarks, discovery queries, or audit results.
- Change GitHub topics or repository homepage settings.

## Validation

- `pnpm install` passed.
- `pnpm run setup` passed and created the missing locked Python environment.
- The first `pnpm contract:export` attempt reported that the Python environment
  was missing; the rerun after setup passed and wrote the artifact.
- `pnpm contract:check` passed, including 15 frontend route-contract tests.
- `pnpm verify` passed: 100 agent-doc checks, API lint, 138 API tests, 4
  structure tests, web lint, 159 web tests, TypeScript, and the production build.

## Result

The web app and local API now ship under the Vibe Coding Starter Kit identity.
The deterministic OpenAPI artifact names the template's local API and rules out
interpretation as a hosted public endpoint. Public docs now explain selection,
reuse, maintenance, support, production caution, and the no-SLA boundary while
retaining the repository's concrete engineering-quality claims.
