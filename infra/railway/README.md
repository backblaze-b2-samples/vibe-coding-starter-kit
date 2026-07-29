<!-- last_verified: 2026-07-28 -->
# Railway Delivery Contract

This is the canonical runbook for Railway. It records the intended deployment
topology without creating a Railway project, deploying code, or storing
environment values in the repository. An authorized human performs every
external action.

## Service Contracts

Railway config-as-code applies to one service deployment at a time. Create two
services from the same repository and set each service's **Config as Code**
path to the absolute repository path below. Config in code overrides the
corresponding dashboard build/deploy settings, but does not configure a service
source, root directory, environment variables, domains, or access controls.

| Service | Root directory | Config as Code path | Build / start | Health check |
| --- | --- | --- | --- | --- |
| `web` | `/` | `/infra/railway/web.railway.json` | root pnpm workspace build; `next start` on Railway's `PORT` | `/` |
| `api` | `/services/api` | `/infra/railway/api.railway.json` | `pip install -r requirements.lock`; Uvicorn on Railway's `PORT` | `/health` |

The web service uses the repository root intentionally: it builds against the
shared workspace package in `packages/shared`. Do not change its root to
`/apps/web` unless the build is redesigned to make that package available.

Both versioned configs use Railpack, constrained watch paths, a 100-second
health-check timeout, and restart-on-failure with ten retries. Railway injects
`PORT`; do not define it manually. The API build installs the committed
`services/api/requirements.lock`, so Railway builds from the same pinned Python
resolution as local setup and CI rather than re-resolving floating versions. The web health check only confirms that
Next.js serves a response. API `/health` returns HTTP 200 even when B2 is
degraded, so post-deploy verification must inspect `b2_connected`, not only the
status code.

## Variables and Public Exposure

Set variable values in the correct Railway service and environment; never put
them in a config file, commit, issue, PR, terminal transcript, or screenshot.

| Service | Variable names | Classification | Notes |
| --- | --- | --- | --- |
| API | `B2_KEY_ID`, `B2_APPLICATION_KEY` | Secret | Limit the B2 key to the app bucket and least privilege. |
| API | `B2_ENDPOINT`, `B2_BUCKET_NAME`, `B2_PUBLIC_URL`, `API_CORS_ORIGINS`, `API_CORS_ORIGIN_REGEX`, `ENABLE_DOCS`, `ALLOWED_KEY_PREFIX`, rate and size settings | Non-secret service configuration | Keep values in Railway, not source; set exact production CORS origins and `ENABLE_DOCS=false`. |
| Web | `NEXT_PUBLIC_API_URL` | Public build-time configuration | Next.js embeds it in browser output; it must be the deployed API origin and contains no credential. |

The browser needs a public API origin, so both services require a deliberate
domain decision. Expose only the intended web and API domains, use an exact API
CORS allowlist, and do not add a public domain to an auxiliary service. Keep
production environment variables, logs, and metrics visible only to people who
operate production; enable Railway production-environment restriction when the
workspace plan supports it and otherwise limit project administration.

## Setup: Human-Approved Only

1. Create isolated `staging` and `production` environments. Keep staging
   non-production and use it for debugging; copy configuration deliberately,
   then replace production secrets rather than sharing values casually.
2. Create the `web` and `api` services, connect the intended repository branch,
   and apply the exact roots and Config as Code paths in the table above.
3. Set only the variable names required by each service. Add domains only after
   a human has reviewed visibility, CORS, and the environment's purpose.
4. For production, disable GitHub autodeploy and deploy the reviewed commit
   manually. If a team deliberately chooses autodeploy for staging, enable
   Railway's wait-for-CI option and keep it scoped to the staging branch.
5. Keep Railway PR environments disabled by default. An authorized human may
   enable a time-bounded preview for a specific PR after confirming the base
   environment, secret exposure, public-domain need, and cleanup owner. Do not
   enable bot PR environments by default.

Never create a project, service, preview, domain, migration, publish operation,
or production deployment without the user's explicit approval. A request to
edit repository documentation or config is not approval to perform one of
those external actions.

## Promotion and Verification

For every staging or production deployment, an authorized human must approve
the specific commit and record who approved it, the target environment, and the
rollback deployment in the PR or change record.

1. Confirm the target commit passed `pnpm verify` and review the config diff.
2. For a preview, verify its isolation and expiration/cleanup owner before
   exposing its URL. For production, confirm the latest approved staging result
   and that automatic GitHub deployment remains disabled.
3. Deploy only the approved service(s) and commit. Never run a migration or a
   publish-like action as an implicit build/start command. Get a separate,
   explicit approval for each migration and publish operation, including its
   rollback plan.
4. Check Railway deployment status and service logs without copying secrets.
   Request `GET /health` from the API and require `b2_connected: true`; load
   the web root and perform the relevant user-flow smoke test. Verify the API's
   exact CORS origin and that interactive API docs are disabled in production.
5. Record the deployed commit, health evidence, smoke-test result, approver,
   and any skipped check. Monitor errors, B2 cost/egress, and Railway spend
   after promotion.

## Rollback, Lifecycle, and Costs

If verification fails or a regression appears, stop promotion and have an
authorized human redeploy the last known-good deployment from Railway's
deployment history. Recheck `/health`, `b2_connected`, the web root, and the
affected user flow. Treat a B2 outage separately from an application rollback:
the API remains live but reports `degraded`.

The project owner is accountable for environment access, domains, deployment
history, Railway spend, B2 storage/egress, and deleting preview environments.
The person requesting a preview names its cleanup owner and deadline. Remove
temporary domains, services, variables, and environments once their approved
purpose ends; verify the removal does not affect production before closing the
change record.

## Configuration Validation

Before opening a PR that changes these files, parse both JSON files and validate
them against Railway's published schema without credentials or a linked project:

```bash
curl --fail --silent --show-error --location \
  https://railway.com/railway.schema.json --output /tmp/railway.schema.json
python3 -m jsonschema --instance infra/railway/web.railway.json /tmp/railway.schema.json
python3 -m jsonschema --instance infra/railway/api.railway.json /tmp/railway.schema.json
```

If `jsonschema` is not installed, validate JSON syntax with `python3 -m json.tool`
and rely on Railway's deployment-details config source before an approved
deployment. Do not install, link, or authenticate the Railway CLI merely to
validate this repository contract.
