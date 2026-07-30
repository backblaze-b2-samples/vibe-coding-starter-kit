<!-- last_verified: 2026-07-30 -->
# Vercel Delivery Contract

This is the canonical runbook for deploying this repository to Vercel. It
records the supported topology without linking a local directory, creating a
Vercel project, deploying code, or storing environment values in the
repository. An authorized human performs every external action.

## Service Contracts

Create **two Vercel Projects** from the same Git repository. Vercel's monorepo
support lets each Project use its own root directory; keeping web and API as
separate origins avoids coupling the Next.js build to the Python runtime.

| Project | Root directory | Framework | Versioned configuration | Health check |
| --- | --- | --- | --- | --- |
| `web` | `apps/web` | Next.js | Next.js auto-detection | `/` |
| `api` | `services/api` | FastAPI | `services/api/vercel.json`, `services/api/.python-version`, and `services/api/index.py` | `/health` |

The web Project consumes `packages/shared` outside its root directory. During
import, keep **Include files outside the Root Directory** enabled (it is the
default for current Vercel monorepo projects). Leave Vercel's build and output
settings at their detected defaults.

Vercel discovers FastAPI applications from a root `index.py` exporting an
`app` instance. The API wrapper imports the existing `main.app`, so Vercel,
local Uvicorn, and tests run the same routes, middleware, and lifespan. Its
versioned config selects FastAPI and installs the committed
`requirements.lock`, rather than resolving the lower-bound input file. The
API Project pins Vercel's Python runtime to 3.12; Vercel defaults to 3.12 today
but that default can change.

## Variables and Public Exposure

Set values in the appropriate Vercel Project and environment. Never put values
in `vercel.json`, source code, an issue, PR, terminal transcript, or screenshot.

| Project | Variable names | Classification | Notes |
| --- | --- | --- | --- |
| API | `B2_KEY_ID`, `B2_APPLICATION_KEY` | Secret | Restrict the B2 key to the intended bucket and least privilege. |
| API | `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_PUBLIC_URL`, `API_CORS_ORIGINS`, `ENABLE_DOCS`, `ALLOWED_KEY_PREFIX`, rate settings | Non-secret configuration | Set an exact web origin in `API_CORS_ORIGINS`; set `ENABLE_DOCS=false` in production. |
| API | `MAX_FILE_SIZE=4000000` | Required Vercel configuration | Leave headroom below Vercel's 4.5 MB Function payload ceiling for multipart overhead. |
| API | `WARM_LIST_CACHE_ON_STARTUP=false` | Recommended Vercel configuration | Avoid an expensive full B2 scan on each cold start. |
| API | `DOWNLOAD_COUNT_FILE=/tmp/download_count.json` | Optional ephemeral configuration | Allows a warm Function instance to write the counter, but it is not durable or shared. |
| Web | `NEXT_PUBLIC_API_URL` | Public build-time configuration | The API Project origin; it contains no credential and must be set before the web build. |

The API is unauthenticated and bucket-wide by design. Do not expose an API
preview casually: it can list, download, upload, and delete the configured
bucket's allowed keys. Create a separate B2 bucket/prefix and credentials for
test or preview environments. Use an exact CORS origin for each environment;
do not set a broad production origin regex merely to accommodate rotating
preview URLs.

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

## Setup: Human-Approved Only

1. Select the correct Vercel team and import the intended repository twice,
   once for each Project in the table above. Confirm the selected root directory
   before deploying.
2. Configure isolated Preview and Production values. Use a dedicated B2
   credential and bucket/prefix for preview; do not copy production secrets as
   a convenience.
3. Deploy a Preview from the approved branch or commit. Add a custom domain
   only after a human reviews visibility, CORS, and the environment's purpose.
4. For production, deploy the reviewed commit only after the latest approved
   Preview result. Configure Git deployment behavior deliberately; a project
   import must not silently turn an unreviewed branch into a production domain.

Never create a project, preview, domain, production deployment, or environment
variable without the user's explicit approval. A request to edit repository
documentation or configuration is not approval to perform any of those actions.

## Promotion, Verification, and Rollback

1. Confirm the target commit passed `pnpm verify` and review the Vercel config
   and environment target.
2. Verify the API deployment's `/health` response includes `b2_connected: true`.
   HTTP 200 alone can mean `degraded` when B2 is unavailable.
3. Verify the web root, API CORS from the browser, and the affected user flow.
   Use a file below 4 MB for the Vercel upload smoke test.
4. Record the deployed commit, preview/production URLs, health evidence,
   smoke-test result, approver, and skipped checks in the PR or change record.

If verification fails, stop promotion and have an authorized human redeploy the
last known-good Vercel deployment. Recheck `/health`, `b2_connected`, the web
root, and the affected flow. Treat a B2 outage separately from an application
rollback: the API remains reachable but reports `degraded`.

The project owner is accountable for Vercel membership, domains, deployment
history, Function usage, B2 storage/egress, and removing temporary Projects,
domains, variables, and preview environments after their approved purpose.

## References

- [FastAPI on Vercel](https://vercel.com/docs/frameworks/backend/fastapi)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel Function limits](https://vercel.com/docs/functions/limitations)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
