# Vercel Delivery Contract

## Goal

Support an explicit, human-operated Vercel deployment for both the Next.js web
application and the FastAPI API from this monorepo, without creating a Vercel
project or storing environment values in the repository.

## Scope

1. Add the Vercel FastAPI function entrypoint and route configuration under the
   API project root.
2. Document the two-project Vercel topology, variables, preview/production
   workflow, verification, rollback, and cleanup.
3. Record the platform's 4.5 MB Function payload limit and the resulting safe
   API upload setting for Vercel.
4. Update architecture, security, reliability, and agent delivery instructions
   so Railway is no longer described as the only supported external deployment
   contract.

## Validation

- `pnpm verify` passed: agent documentation, API lint/tests/structure, web
  lint/tests, TypeScript, and production build.
- The Vercel API entrypoint import is covered by a regression test.
- No Vercel project was linked, provisioned, deployed, or configured.

## Result

The API exports the existing FastAPI app from the Vercel-recognized root
`index.py`, pins Vercel's Python runtime to 3.12, and installs the committed
dependency lock. The Vercel runbook requires two Projects and constrains API
uploads to 4 MB to stay below Vercel Functions' 4.5 MB payload limit.
