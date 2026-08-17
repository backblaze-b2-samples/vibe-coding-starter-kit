# Awesome azd Listing Packet

This packet contains the public metadata needed for an Awesome azd submission.
It does not submit the template or create Azure resources.

## Listing Fields

| Field | Value |
| --- | --- |
| Title | Vibe Coding Starter Kit with Backblaze B2 |
| Description | A full-stack Next.js and FastAPI starter with a pre-built dashboard, direct browser uploads, and Backblaze B2 object storage, deployed as two Azure Container Apps. |
| Author | Backblaze Labs |
| Source | `https://github.com/backblaze-b2-samples/vibe-coding-starter-kit` |
| Screenshot | `https://raw.githubusercontent.com/backblaze-b2-samples/vibe-coding-starter-kit/main/docs/images/b2-starterkit-dashboard1.png` |
| Tags | AI, Containers, Storage, Web App |
| Languages | TypeScript, Python |
| Frameworks | Next.js, FastAPI |
| Azure services | Azure Container Apps, Azure Container Registry, Log Analytics, Managed Identities |
| Infrastructure as code | Bicep |
| Template UUID | `088bac24-f159-406d-9755-f9e29c6a3686` |

## Reviewer Notes

- `azure.yaml` declares both services and pins the minimum `azd` version.
- `infra/azure/main.bicep` pins Azure Verified Modules, applies matching
  `azd-service-name` tags, and preserves deployed images across reprovisioning.
- The web image receives the provisioned API URI as a public build argument.
- B2 credentials are secure Bicep parameters and Container Apps secret refs.
- The delivery contract states cost, public-ingress, CORS, verification,
  rollback, and cleanup boundaries.

## Submission Gate

Do not open the Awesome azd PR until an authorized Azure deployment has proved
`azd up`, API health, browser upload, cleanup, and the screenshot against a
reviewed commit. Record the exact commit and evidence in distribution issue
`backblaze-labs/demand-side-ai#447`; then submit this metadata without adding a
second tracking issue.

For the first four weeks after publication, record gallery referrals and GitHub
traffic as leading signals. Use Backblaze attribution for the existing
`b2ai-oss-start` custom user agent as the objective storage-usage signal. Azure
resource telemetry belongs to each deployer's subscription and is not a
publisher-wide adoption count.
