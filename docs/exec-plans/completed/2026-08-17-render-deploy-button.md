# Render Deploy Button

## Goal

Ship a repository-backed Deploy to Render button that provisions the complete
VCSK stack from a root `render.yaml`: one Next.js web service and one FastAPI
service, both connected to the deployer's Backblaze B2 bucket.

No Render service, Blueprint, preview, account, or public resource is created by
this work. A human chooses whether to click and approve the button later.

## Plan

1. Add a two-service `render.yaml` at the repository root, with free instances,
   `autoDeploy: false`, required B2 credential prompts, health checks, and
   cross-service hostname references.
2. Wire the services with Render's full `RENDER_EXTERNAL_URL` default variable,
   copied through `fromService`, so the existing frontend URL and API CORS
   contracts work unchanged.
3. Add the Deploy to Render button and a concise README path to first success.
   Add `infra/render/README.md` as the canonical setup, verification, security,
   rollback, and cleanup contract.
4. Update architecture, security, reliability, and agent guardrails so the
   Render button cannot drift into a partial-app deploy.
5. Validate the Blueprint against Render's published schema and run
   `pnpm verify` before opening a draft PR.

## Verification

- `render.yaml` parsed as YAML and passed Render's published JSON Schema via
  `uvx check-jsonschema`.
- `pnpm check:agent-docs` passed 125 checks.
- API lint, 187 API tests, 4 structural tests, frontend lint, and 164 frontend
  tests passed.
- The canonical `pnpm verify` reached the final Next.js build; Turbopack could
  not bind its internal port inside the local sandbox. The equivalent
  `next build --webpack` completed successfully. PR CI remains the unrestricted
  confirmation of the canonical build.
- The deploy button was not clicked and no Render resource was created.

## Outcome

The README now exposes a Deploy to Render button backed by a root Blueprint
that provisions both application services, prompts for B2 configuration, and
cross-wires their generated public URLs. The delivery contract covers the
remaining human-approved deployment, verification, rollback, and cleanup
steps. A dependency-free agent-doc guard prevents the button from drifting into
a partial or incorrectly wired deployment.
