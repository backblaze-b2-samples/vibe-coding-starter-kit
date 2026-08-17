# Azure Developer CLI Template

## Goal

Prepare the complete starter kit for an Awesome azd submission without
provisioning Azure resources or submitting external forms.

## Plan

1. Add two production container definitions and a secret-safe build context.
2. Map the web and API services in `azure.yaml`.
3. Define pinned Bicep infrastructure for Azure Container Apps, ACR, managed
   identities, and capped logs.
4. Document cost, approval, CORS, verification, rollback, and cleanup.
5. Prepare the Awesome azd listing fields and validate all static artifacts.

## Outcome

- Added an `azd` manifest for two remotely built Azure Container Apps.
- Added non-root Next.js and FastAPI images with pinned application
  dependencies and no committed environment values.
- Added compiled Bicep for Container Apps, Basic ACR, pull identities, and a
  Log Analytics workspace capped at 1 GB per day.
- Passed B2 credentials through secure Bicep parameters and Container Apps
  secret references, and fixed the API CORS origin to the provisioned web URI.
- Added the human approval, cost, B2 bucket CORS, verification, rollback, and
  cleanup contract plus the complete Awesome azd listing packet.
- Added credential-free guardrails to `pnpm check:agent-docs` so a partial or
  secret-unsafe Azure template fails CI.

## Verification

- `git diff --check` passed.
- `azure.yaml` parsed successfully and `main.parameters.json` is valid JSON.
- Azure Developer CLI 1.31.1 loaded the manifest and reported both `web` and
  `api` services with `azd show --no-prompt`; no environment was created.
- Bicep 0.46.1 compiled `infra/azure/main.bicep` with all pinned Azure Verified
  Modules restored; no subscription or Azure authentication was used.
- `node scripts/check-agent-docs.mjs` passed with 137 checks.
- Both Docker images built locally without publishing.
- The FastAPI container started as the non-root user and `/health` returned the
  expected degraded response with deliberately fake B2 values.
- The Next.js container started as the non-root user and returned the dashboard
  HTML from `/` with the API URL embedded at build time.
- The two temporary containers and validation images were removed and the
  pre-existing Colima runtime was returned to its stopped state.

No Azure account, resource, deployment, gallery submission, or live B2 change
was created during validation.
