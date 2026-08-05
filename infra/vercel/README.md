<!-- last_verified: 2026-08-05 -->
# Vercel Delivery Contract

This is the canonical runbook for deploying this repository to Vercel. It
records the supported topology without linking a local directory, creating a
Vercel project, deploying code, or storing environment values in the
repository. An authorized human performs every external action.

## Topology: one project with Vercel Services

The default is a **single Vercel project** that uses
[Vercel Services](https://vercel.com/docs/services): the Next.js web app and the
FastAPI API build from the same repository and share one origin, one domain, and
one deployment.

| Service | Root directory | Framework | Public path | Health check |
| --- | --- | --- | --- | --- |
| `web` | `apps/web` | Next.js | `/` | `/` |
| `api` | `services/api` | FastAPI | `/api/*` | `/api/health` |

The repo-root `vercel.json` declares both services and the public route table:
`/api/(.*)` routes to the `api` service and everything else routes to the `web`
service. Because they share an origin there is **no CORS and no
`NEXT_PUBLIC_API_URL`** — the web client calls the relative `/api`, and a
production build defaults `API_BASE` to `/api` when the variable is unset.

FastAPI keeps its native paths (`/health`, `/files`, `/upload`, …). The
Vercel-only entrypoint `services/api/index.py` is a thin ASGI wrapper that
strips the `/api` prefix before delegating to `main.app`, so local dev, tests,
and the checked-in OpenAPI contract are unchanged — the prefix exists only in
production, only in that file.

The `web` service installs the pnpm workspace from the repo root
(`cd ../.. && pnpm install`), which resolves `packages/shared`. The `api`
service installs the committed `requirements.lock` and pins Vercel's Python
runtime through `services/api/.python-version`.

## Dependabot Preview Builds Are Skipped

Each service declares an `ignoreCommand` (Vercel's [Ignored Build
Step](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand))
that cancels the build when the branch matches `dependabot/*`, so Dependabot's
per-dependency PRs never spend Vercel build minutes. The command exits `0`
(skip) for those branches and `1` (build) for everything else, so normal PRs —
including a grouped/aggregated dependency PR opened on any non-`dependabot/*`
branch — still get a Preview. In Services mode `ignoreCommand` is a per-service
field, so it lives inside both `web` and `api`; in the two-Project alternative
it sits at the top level of each Project's `vercel.json`. GitHub Actions CI is
skipped for the same PRs via an actor guard in `.github/workflows/ci.yml`.

## Variables and Public Exposure

Set values in the Vercel Project and environment. Never put values in
`vercel.json`, source code, an issue, PR, terminal transcript, or screenshot.

| Variable names | Classification | Notes |
| --- | --- | --- |
| `B2_KEY_ID`, `B2_APPLICATION_KEY` | Secret | Restrict the B2 key to the intended bucket and least privilege. |
| `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_PUBLIC_URL`, `ENABLE_DOCS`, `ALLOWED_KEY_PREFIX`, rate settings | Non-secret configuration | Set `ENABLE_DOCS=false` in production. |
| `MAX_FILE_SIZE=4000000` | Required Vercel configuration | Leave headroom below Vercel's 4.5 MB Function payload ceiling for multipart overhead. |
| `WARM_LIST_CACHE_ON_STARTUP=false` | Recommended Vercel configuration | Avoid an expensive full B2 scan on each cold start. |
| `DOWNLOAD_COUNT_FILE=/tmp/download_count.json` | Optional ephemeral configuration | Lets a warm Function instance write the counter, but it is not durable or shared. |

In the single-project topology the web and API share an origin, so
`NEXT_PUBLIC_API_URL` and `API_CORS_ORIGINS` are **not** required. They apply
only to the two-Projects alternative below.

The API is unauthenticated and bucket-wide by design. Do not expose an API
preview casually: it can list, download, upload, and delete the configured
bucket's allowed keys. Create a separate B2 bucket/prefix and credentials for
test or preview environments.

## Platform Limits and Fit

FastAPI runs as one Vercel Function and Vercel Functions have a 4.5 MB maximum
request or response payload. The API's normal 100 MB local upload default is
therefore incompatible with Vercel. `MAX_FILE_SIZE=4000000` is mandatory for
this topology; uploads above the platform limit are rejected by Vercel before
FastAPI can return its own validation response.

For uploads larger than this, redesign the flow to have the API issue a
short-lived B2 presigned upload and have the browser upload directly to B2. Do
not raise `MAX_FILE_SIZE` and assume Vercel will stream larger multipart bodies.

Function instances are short-lived and can scale independently. Listing caches,
rate limits, metrics, and the download counter are per instance; the filesystem
is not durable. Use shared storage/Redis or a metrics collector where globally
accurate state matters. Review Function duration, regional placement, bundle
size, and spending in Vercel before promoting a workload with large buckets or
slow B2 access.

## One-Click Deploy Button

The repository README carries a single Vercel deploy button. It opens Vercel's
clone flow for the whole repository (no root directory), so Vercel reads the
repo-root `vercel.json` and creates one Services project:

| `root-directory` | Pre-filled `env` |
| --- | --- |
| _(none — repo root)_ | `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_ENDPOINT`, `B2_BUCKET_NAME`, `MAX_FILE_SIZE` |

The button deliberately does not pre-set the `ENABLE_DOCS=false` and
`WARM_LIST_CACHE_ON_STARTUP=false` production values; set those in the Project
afterward per the table above. A button is a convenience, not an authorization:
creating the Project, its environment variables, and any deployment remains a
human-approved action.

## Alternative: two separate Projects

If Services is unavailable, or you want the web and API on **separate origins**
(independent scaling, independent domains), create **two Vercel Projects** from
the same repository instead:

| Project | Root directory | Framework | Versioned configuration | Health check |
| --- | --- | --- | --- | --- |
| `web` | `apps/web` | Next.js | `apps/web/vercel.json` (installs the pnpm workspace from the repo root) | `/` |
| `api` | `services/api` | FastAPI | `services/api/vercel.json`, `services/api/.python-version`, `services/api/index.py` | `/health` |

Keep **Include files outside the Root Directory** enabled (the default) so the
web build can reach `packages/shared`. Deploy the API first and copy its origin;
then set the web Project's `NEXT_PUBLIC_API_URL` to that origin (Next.js inlines
it at build time — redeploy the web after changing it). Finally set the API
Project's `API_CORS_ORIGINS` to the exact web origin and redeploy the API, or
the browser blocks every cross-origin call. Use an exact CORS origin per
environment; do not set a broad production origin to accommodate rotating
preview URLs.

## Setup: Human-Approved Only

1. Select the correct Vercel team and import the repository. For the default
   topology, import once (Vercel reads the repo-root `vercel.json` and creates
   the Services project). For the alternative, import twice and set each
   Project's root directory.
2. Configure isolated Preview and Production values. Use a dedicated B2
   credential and bucket/prefix for preview; do not copy production secrets as
   a convenience.
3. Deploy a Preview from the approved branch or commit. Add a custom domain
   only after a human reviews visibility, CORS (alternative only), and the
   environment's purpose.
4. For production, deploy the reviewed commit only after the latest approved
   Preview result. Configure Git deployment behavior deliberately; a project
   import must not silently turn an unreviewed branch into a production domain.

Never create a project, preview, domain, production deployment, or environment
variable without the user's explicit approval. A request to edit repository
documentation or configuration is not approval to perform any of those actions.

## Promotion, Verification, and Rollback

1. Confirm the target commit passed `pnpm verify` and review the Vercel config
   and environment target.
2. Verify the API deployment's health response includes `b2_connected: true` —
   `GET /api/health` in the single-project topology, `GET /health` on the API
   Project in the alternative. HTTP 200 alone can mean `degraded` when B2 is
   unavailable.
3. Verify the web root, the affected user flow, and (alternative only) API CORS
   from the browser. Use a file below 4 MB for the Vercel upload smoke test.
4. Record the deployed commit, preview/production URLs, health evidence,
   smoke-test result, approver, and skipped checks in the PR or change record.

If verification fails, stop promotion and have an authorized human redeploy the
last known-good Vercel deployment. Recheck health, `b2_connected`, the web root,
and the affected flow. Treat a B2 outage separately from an application
rollback: the API remains reachable but reports `degraded`.

The project owner is accountable for Vercel membership, domains, deployment
history, Function usage, B2 storage/egress, and removing temporary Projects,
domains, variables, and preview environments after their approved purpose.

## References

- [Vercel Services](https://vercel.com/docs/services)
- [Services routing](https://vercel.com/docs/services/routing)
- [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
