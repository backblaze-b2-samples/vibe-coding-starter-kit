<!-- last_verified: 2026-08-17 -->
# Render Delivery Contract

This is the canonical runbook for the repository's Render Blueprint and deploy
button. The versioned configuration describes the intended topology; it does
not create a Render account, service, Blueprint, preview, or public resource.
An authorized human approves every external action.

## One Blueprint, Two Services

The root [`render.yaml`](../../render.yaml) creates the complete application:

| Service | Repository root | Runtime | Public route | Health check |
| --- | --- | --- | --- | --- |
| `vcsk-web` | `/` | Node.js 20 / Next.js | `/` | `/` |
| `vcsk-api` | `/services/api` | Python 3.12 / FastAPI | API routes | `/health` |

The web service builds from the repository root because it consumes the shared
workspace package in `packages/shared`. The API installs the committed
`requirements.lock`, matching local setup and CI. Both services use free
instances and `autoDeploy: false`; review current Render limits before relying
on them for anything beyond evaluation.

Render supplies each service's full HTTPS `RENDER_EXTERNAL_URL`. The Blueprint
copies the API URL to the web service as `NEXT_PUBLIC_API_URL` and the web URL
to the API as `API_CORS_ORIGINS`. No cross-service URL or API CORS value needs
to be entered by hand.

## Variables and Public Exposure

The deploy form prompts for these API variables and stores them in Render:

| Variable | Classification | Notes |
| --- | --- | --- |
| `B2_KEY_ID`, `B2_APPLICATION_KEY` | Secret | Use a least-privilege key restricted to this app's bucket. |
| `B2_ENDPOINT`, `B2_BUCKET_NAME` | Service configuration | Copy the exact values from the B2 bucket. |

The Blueprint fixes `ENABLE_DOCS=false` and
`WARM_LIST_CACHE_ON_STARTUP=false`. The latter avoids a B2 scan during startup,
which helps cold starts complete predictably. `NEXT_PUBLIC_API_URL` is public
build-time configuration and must never contain a credential.

The API is unauthenticated and can operate across the configured bucket. Use a
dedicated bucket and key for any public preview, keep Render variables and logs
limited to authorized operators, and do not share a deployment backed by
production data.

## Deploy: Human-Approved Only

The README button opens Render with this repository explicitly selected:

```text
https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Fbackblaze-b2-samples%2Fvibe-coding-starter-kit
```

1. Review the commit and the complete `render.yaml` diff.
2. Click the button, sign in to Render, choose the intended workspace, and
   enter only the requested B2 values.
3. Review both services before approving Blueprint creation. Keep automatic
   deploys disabled.
4. After Render assigns the web URL, add that exact origin to the B2 bucket's
   CORS rules. The helper merges the rule without replacing existing entries:

   ```bash
   python services/api/scripts/setup_b2_cors.py --origin https://<web-service>.onrender.com --apply
   ```

Never click the button, create a Blueprint or service, expose a domain, or
deploy from an automated repository-maintenance task without the user's
explicit approval.

## Verification

1. Confirm both services built from the approved commit and review their logs
   without copying environment values.
2. Request the API's `/health` endpoint and require `b2_connected: true`; HTTP
   200 alone is not enough because a degraded B2 connection still reports 200.
3. Load the web root and use the browser to upload, list, download, and delete a
   test file. A browser upload is required because a server-side request cannot
   detect a missing B2 bucket CORS rule.
4. Confirm the API accepts only the generated web origin and that `/docs` is
   disabled.
5. Record the commit, health evidence, smoke-test result, approver, and cleanup
   owner in the change record.

Validate configuration changes before review with the Render CLI when it is
available:

```bash
render blueprints validate render.yaml
```

The repository also checks the whole-app button contract in
`pnpm check:agent-docs`, and the canonical credential-free gate remains
`pnpm verify`.

## Rollback and Cleanup

If verification fails, suspend promotion and redeploy the last known-good
commit from Render's deployment history. Recheck both health endpoints and the
affected browser flow. A B2 outage is not necessarily an application
regression; the API reports it as degraded.

Delete temporary services and their Blueprint when the approved evaluation
ends, then remove the retired web origin from the B2 bucket's CORS rules. The
deployment owner remains responsible for Render usage, B2 storage and egress,
domains, variables, logs, and cleanup.

## References

- [Deploy to Render button](https://render.com/docs/deploy-to-render)
- [Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render environment variables](https://render.com/docs/environment-variables)
