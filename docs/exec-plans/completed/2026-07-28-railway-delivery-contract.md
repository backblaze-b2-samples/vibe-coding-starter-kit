<!-- last_verified: 2026-07-28 -->
# Versioned Railway Delivery Contract

## Goal

Replace the dashboard-only Railway instructions with versioned per-service
configuration and a safe, human-approved delivery runbook for the web and API
services.

## Scope

- Add one Railway JSON config per service under `infra/railway/`.
- Record the two-service monorepo topology, environment-variable classes,
  verification, rollback, lifecycle, and approval boundaries in the Railway
  runbook.
- Link the canonical agent instruction surface and architecture, security, and
  reliability docs to the canonical runbook without duplicating it.

## Design

Railway config-as-code applies to one service deployment at a time. The web
service runs from the repository root because it consumes `packages/shared`;
the API runs from `services/api`. Each service is configured to use its own
custom absolute config path in Railway, so both service contracts stay
versioned even though their configuration files live together in
`infra/railway/`.

Production remains a dashboard-controlled external operation. The repository
records the expected configuration and review workflow but never provisions,
deploys, or stores Railway credentials or environment values.

## Verification

1. Parse both JSON configs and validate their keys/types against Railway's
   published JSON schema without linking to a Railway project.
2. Check docs and config for secret values or contradictory service commands.
3. Run `pnpm verify`.

## Completion Criteria

- Both service build/start, port, health, restart, and watch behavior are
  versioned.
- The runbook requires explicit approval for previews, production changes,
  migrations, and publish operations and defines verification, rollback, cost
  ownership, and cleanup.
- The deployment safety boundary is discoverable from `AGENTS.md`.
