<!-- last_verified: 2026-08-13 -->
# Railway Delivery Contract

This is the canonical runbook for Railway. It records the intended deployment
topology without creating a Railway project, deploying code, or storing
environment values in the repository. An authorized human performs every
external action.

## Service Contracts

Railway config-as-code applies to one service deployment at a time. Create two
services from the same repository, set each service's root directory to the
value below, and Railway discovers that service's config file on its own.
Config in code overrides the corresponding dashboard build/deploy settings, but
does not configure a service source, root directory, environment variables,
domains, or access controls.

| Service | Root directory | Config file | Build / start | Health check |
| --- | --- | --- | --- | --- |
| `web` | `/` | `railway.json` | root pnpm workspace build; `next start` on Railway's `PORT` | `/` |
| `api` | `/services/api` | `services/api/railway.json` | `pip install -r requirements.lock`; Uvicorn on Railway's `PORT` | `/health` |

Each file sits at the **default discovery path for its service's root
directory**, so there is nothing to type into the dashboard's **Config as Code**
field — leave it empty. Keep them there. A custom location works only when a
human sets that field per service, and anyone deploying this repository as a
one-click template never opens dashboard settings; from a default path the same
build, start, and health behavior is inherited automatically.

The web service uses the repository root intentionally: it builds against the
shared workspace package in `packages/shared`. Do not change its root to
`/apps/web` unless the build is redesigned to make that package available. Its
config file is therefore the repository-root `railway.json`, alongside
`vercel.json`.

Both versioned configs use Railpack, constrained watch paths, a 100-second
health-check timeout, and restart-on-failure with ten retries. Railway injects
`PORT`; do not define it manually.

The web service starts with `pnpm --filter … exec next start …`, not
`pnpm --filter … start -- …`. The `--` separator does not survive the trip: pnpm
forwards it to the script, Next treats it as the end of its own options, and the
next token becomes a positional *project directory* — the container then
crash-loops on `Invalid project directory provided, no such directory:
/app/apps/web/--hostname` while the build reports success. `exec` runs the
binary in the workspace directly, so the flags arrive as flags. The API build installs the committed
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

### The B2 bucket needs its own CORS rule for the web domain

`API_CORS_ORIGINS` is not the only CORS to configure, and the second one is on
the B2 side. Uploads go **browser → B2** via a presigned PUT, so the *bucket*
must allow the deployed web origin (method `PUT`, header `content-type`) or the
browser blocks every upload before it leaves. Nothing in Railway can do this for
you, and it is invisible until you try to upload: `/health` reports
`b2_connected: true`, the UI loads, listing works, and only uploading fails.

Add the rule once per deployed web origin, with the helper that merges rather
than replaces existing rules:

```bash
python services/api/scripts/setup_b2_cors.py --origin https://<web-domain> --apply
```

Local development rarely trips this because `localhost` origins are usually
already allowed on a bucket used for development — which is exactly why the
failure shows up for the first time right after a deploy. Remove the rule when
the deployment is retired, and keep the allowlist to origins that still exist.

## Setup: Human-Approved Only

1. Create isolated `staging` and `production` environments. Keep staging
   non-production and use it for debugging; copy configuration deliberately,
   then replace production secrets rather than sharing values casually.
2. Create the `web` and `api` services, connect the intended repository branch,
   and apply the exact root directories in the table above. Leave **Config as
   Code** empty; each service picks up its own `railway.json` from that root.
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
   **A deployment status of `SUCCESS` is not evidence the app runs.** A service
   with no configured health check reports success the moment the container
   starts, so it can crash-loop behind a green deployment; confirm the deployed
   commit (`railway deployment list --json`, `meta.commitHash`) and read the
   deploy logs, not just the status.
5. Smoke-test an **upload from a browser**, not only from `curl`. A server-side
   request bypasses CORS entirely, so the bucket-CORS rule above can be missing
   and every scripted check will still pass while real users cannot upload.
6. Record the deployed commit, health evidence, smoke-test result, approver,
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
python3 -m jsonschema --instance railway.json /tmp/railway.schema.json
python3 -m jsonschema --instance services/api/railway.json /tmp/railway.schema.json
```

If `jsonschema` is not installed, validate JSON syntax with `python3 -m json.tool`
and rely on Railway's deployment-details config source before an approved
deployment. Do not install, link, or authenticate the Railway CLI merely to
validate this repository contract.
