# Railway Listing Packet

## Goal

Turn the completed Railway research in distribution issue #435 into a
versioned, copy-ready publication packet. This work must not create, deploy, or
publish any Railway resource and must not require a paid account.

## Plan

1. Record the final gallery name, category, description, and overview copy.
2. Define the exact required prompts, derived variables, fixed variables, and
   per-variable help text for the two-service template.
3. Record UTM-tagged linkbacks, deployer expectations, and the metric capture
   contract.
4. Link the packet from the canonical Railway delivery contract.
5. Run the repository documentation guard and canonical verification suite.

## Verification

- `pnpm check:agent-docs` passed 110 checks.
- API lint, 187 API tests, 4 structural tests, frontend lint, and 164 frontend
  tests passed.
- The canonical `pnpm verify` reached the final Next.js build; Turbopack could
  not bind its internal port inside the local sandbox. The equivalent
  `next build --webpack` completed successfully. PR CI remains the unrestricted
  confirmation of the canonical build.
- No Railway login, workspace, project, service, template, or deployment was
  created.

## Outcome

The final Railway display name, category, short description, overview,
variable prompts, per-variable help text, UTM linkbacks, publication checklist,
and four-week metrics contract are versioned in `infra/railway/LISTING.md`. The
only remaining inputs are the paid company workspace, the generated template
code, and explicit approval to publish and validate externally.
