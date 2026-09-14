# Azure Developer CLI Delivery Contract

This directory makes the complete Next.js and FastAPI application deployable
with Azure Developer CLI (`azd`). The versioned template defines two Azure
Container Apps, a Basic Azure Container Registry, a Container Apps environment,
two managed identities, and a capped Log Analytics workspace. Nothing in this
repository provisions Azure resources by itself.

> **Cost and approval boundary:** `azd up`, `azd provision`, and `azd deploy`
> create or change billable, publicly reachable Azure resources. Run them only
> after an authorized human has approved the subscription, region, expected
> spend, public exposure, and cleanup owner. Repository validation never runs
> those commands.

## Topology

| Service | Container | Ingress | Health | Configuration |
| --- | --- | --- | --- | --- |
| `web` | Next.js on port 3000 | Public HTTPS | `/` readiness probe | The API URL is embedded at image build time from `SERVICE_API_URI`. |
| `api` | FastAPI on port 8000 | Public HTTPS | `/health` readiness and liveness probes | B2 credentials use Container Apps secrets; the web origin is the exact CORS allowlist. |

Both services use remote ACR builds, a dedicated pull identity, one replica,
0.5 vCPU, and 1 GiB memory. The fixed replica count makes cost behavior
explicit but means the deployment is not free. Review current Azure pricing
before approval. Secrets are passed through secure Bicep parameters and are not
stored in source.

## Human-Approved Setup

Prerequisites are Azure Developer CLI 1.21 or newer, an Azure subscription,
and a dedicated B2 bucket with a least-privilege application key.

1. Initialize the template and authenticate:

   ```bash
   azd init --template backblaze-b2-samples/vibe-coding-starter-kit
   azd auth login
   ```

2. Create or select an `azd` environment. Set `B2_ENDPOINT`,
   `B2_BUCKET_NAME`, `B2_KEY_ID`, and `B2_APPLICATION_KEY` in that environment.
   For production, prefer `azd env set-secret` with an approved Key Vault for
   the two credential values. For an evaluation environment, `azd env set`
   stores values in the local `.azure/<environment>/.env`; `.azure/` is ignored
   by git, but the file is still sensitive and must not be shared or printed.

3. Review the Bicep plan, subscription, region, cost estimate, public ingress,
   and cleanup owner. Only then may an authorized human run:

   ```bash
   azd up
   ```

The deployment creates Azure infrastructure before it builds and deploys both
containers. `SERVICE_API_URI`, produced by Bicep, becomes the web image's
`NEXT_PUBLIC_API_URL` build argument.

## B2 Bucket CORS

Uploads go directly from the browser to B2 with a presigned PUT, so the B2
bucket must allow the deployed `SERVICE_WEB_URI`. After the web URI exists, an
authorized human can merge that origin into the bucket CORS configuration:

```bash
python services/api/scripts/setup_b2_cors.py --origin "$(azd env get-value SERVICE_WEB_URI)" --apply
```

This changes the B2 bucket and therefore is not part of repository validation.
Remove the origin when the Azure environment is retired.

## Verification and Rollback

Before deployment, run the credential-free repository suite and static Azure
checks described below. After an approved deployment:

1. Require `GET $SERVICE_API_URI/health` to return `b2_connected: true`.
2. Load `SERVICE_WEB_URI` and upload a small file from a browser, which verifies
   both API CORS and B2 bucket CORS.
3. Confirm interactive API docs are disabled and review Container Apps logs
   without copying environment values.
4. Record the commit, environment, subscription, region, approver, and cleanup
   owner in the change record.

For an application regression, redeploy the last reviewed commit with
`azd deploy`. For a failed or temporary environment, an authorized human can
run `azd down` only after checking the exact subscription and environment name.
That command deletes the template's Azure resource group and is destructive.

## Static Validation

The safe pre-PR checks create no account, login, resource, or deployment:

```bash
node scripts/check-agent-docs.mjs
az bicep build --file infra/azure/main.bicep --stdout >/dev/null
```

The second command requires Azure CLI with Bicep installed and downloads only
the pinned Azure Verified Modules. If Azure CLI is unavailable, CI can run the
same Bicep compilation later; do not substitute `azd provision` as validation.

Container builds can be tested when a local Docker daemon is already available:

```bash
docker build --file apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
docker build --file services/api/Dockerfile .
```

Do not run a live B2 test or publish either image as part of this contract.
