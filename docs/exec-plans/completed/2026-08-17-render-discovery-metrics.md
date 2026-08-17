# Render Discovery and Metrics Contract

## Goal

Finish the free repository work required by distribution issue #436: state the
actual Render discovery surface, resolve which listing fields do not apply, add
attributed B2 links, and define the metrics path for the repository button.

No Render resource or analytics service is created by this work.

## Plan

1. Record that Render offers a repository Blueprint button but no public
   third-party gallery submission or publisher listing metadata.
2. Add attributed B2 setup links to the delivery contract.
3. Define available leading indicators, unavailable publisher metrics, and the
   B2 custom-user-agent path to the objective.
4. Run documentation checks and the repository verification suite.

## Outcome

- Documented the repository button as the complete Render discovery surface;
  no unsupported gallery or Marketplace claim remains.
- Kept the public product name in GitHub and the two Render service names as
  deployment-only identifiers.
- Added attributed B2 account and application-key links.
- Defined a four-week measurement contract using GitHub traffic as a leading
  signal and Backblaze custom-user-agent attribution as the objective signal.
- Explicitly recorded that publisher-wide Render deployment counts are not
  available without adding an approved redirect or analytics dependency.

## Verification

- `pnpm check:agent-docs` passed (125 checks).
- API lint, 187 API tests, and 4 structural tests passed.
- Frontend lint and 164 frontend tests passed.
- The canonical Turbopack build reached its final build step but could not bind
  its internal sandbox port; `pnpm --filter @vibe-coding-starter-kit/web exec
  next build --webpack` passed as the sandbox-compatible production build.
