<!-- last_verified: 2026-08-17 -->
# Railway Listing Packet

This file contains the reviewed copy and configuration decisions for publishing
the Vibe Coding Starter Kit as a Railway template. It is preparation only: the
repository does not contain a Railway template code, and following this document
must not create or publish a template without explicit approval.

The deployment and operational rules remain canonical in
[`infra/railway/README.md`](README.md). Distribution tracking lives in
[`backblaze-labs/demand-side-ai#435`](https://github.com/backblaze-labs/demand-side-ai/issues/435).

## Gallery Identity

| Field | Final value | Reason |
| --- | --- | --- |
| Display name | **Object Storage File Uploader with Backblaze B2** | Leads with the use case, names the storage provider, and avoids the crowded generic starter-kit naming pattern. |
| Category | **Storage** | Railway permits one category. Comparable managed data-service starters such as Neon and Xata already use Storage successfully. |
| Repository name | **Vibe Coding Starter Kit** | The public repository keeps its existing identity; only the Railway listing uses the descriptive name. |
| Publisher | **Backblaze** | Publish only from a company-owned Railway workspace, never from a personal workspace. |

The Railway project must be created with the final display name before template
generation. Railway template generation inherits the project name and exposes
no API mutation for renaming the generated template.

## Short Description

```text
Next.js and FastAPI file uploader and explorer with Backblaze B2 object storage, built for vibe coding with AI agents.
```

## Overview Copy

Use the following Markdown as the template overview. Do not add a live demo: the
API is intentionally unauthenticated and bucket-wide, so a shared deployment
would expose every visitor to the same files.

```markdown
## Object Storage File Uploader with Backblaze B2

Deploy a full-stack Next.js and FastAPI dashboard with direct browser uploads,
file browsing, previews, downloads, deletes, and metadata extraction backed by
Backblaze B2 object storage.

### What gets deployed

- A Next.js web service with the dashboard, upload flow, and file explorer
- A FastAPI service that creates presigned B2 requests and manages file metadata
- Generated public domains and cross-service variables for the web and API

You provide a B2 bucket and a least-privilege application key during deployment.
The template never stores credentials in source code.

### Before the first upload

Uploads go directly from the browser to B2. Add the deployed web origin to your
bucket CORS rules after Railway assigns its domain:

`python services/api/scripts/setup_b2_cors.py --origin https://<web-domain> --apply`

Then verify the API `/health` response reports `b2_connected: true` and upload,
list, download, and delete one test file from the browser.

### Make the code yours

Railway deploys the services from the template repository by default. Use
**Eject** after deployment when you want a copy in your own GitHub account to
rebrand and extend.

### Resources

- [Create a Backblaze B2 account](https://www.backblaze.com/sign-up/ai-cloud-storage?utm_source=railway&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-oss-start)
- [Create a bucket and application key](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys?utm_source=railway&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-oss-start)
- [Vibe Coding Starter Kit source](https://github.com/backblaze-b2-samples/vibe-coding-starter-kit)
- [Backblaze Labs](https://www.backblazelabs.com/?utm_source=railway&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-oss-start)
```

## Template Variables

Only the four B2 values are user prompts. Put them on the API service and use
the following help text verbatim:

| Variable | Required | Secret | Help text |
| --- | --- | --- | --- |
| `B2_KEY_ID` | Yes | Yes | Application Key ID for a least-privilege key restricted to this app bucket. |
| `B2_APPLICATION_KEY` | Yes | Yes | Application Key secret. Backblaze shows this value only once when the key is created. |
| `B2_ENDPOINT` | Yes | No | Full S3 endpoint from the bucket details, including `https://`, for example `https://s3.us-west-004.backblazeb2.com`. |
| `B2_BUCKET_NAME` | Yes | No | Exact unique name of the Backblaze B2 bucket used by this app. |

The template owns these derived or fixed values. They are not user prompts:

| Service | Variable | Value |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
| API | `API_CORS_ORIGINS` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| API | `ENABLE_DOCS` | `false` |
| API | `WARM_LIST_CACHE_ON_STARTUP` | `false` |

Do not carry `ALLOWED_KEY_PREFIX`, `B2_PUBLIC_URL`, or optional rate/size values
into the default prompt list. A deployer can add them later when the use case
requires them. Create the API public domain before building the web service:
`NEXT_PUBLIC_API_URL` is embedded in browser output at build time.

## Publication Checklist

1. Use the approved Backblaze-owned Railway workspace and a reviewed commit on
   the repository default branch.
2. Create the project with the final display name above, then deploy both
   services using their documented root directories.
3. Generate a fresh template. Discard any draft inherited from a pilot or
   personal workspace.
4. Remove accidental prompts, add the help text above, set the category to
   Storage, and paste the short description and overview without modification.
5. Review the full template diff and publish only after explicit approval.
6. Deploy the published template into a clean project, inspect every prompt,
   configure bucket CORS, and complete the browser smoke test in the delivery
   contract.
7. Delete the verification project and remove its bucket CORS origin.
8. Add the final template code to the README Deploy on Railway button in a
   separate reviewed change. A repository URL is not a valid substitute.

## Metrics Contract

Capture a baseline at publication, then weekly for the first four weeks:

| Signal | Source | Record |
| --- | --- | --- |
| Total deployments | Railway public template API | `projects` |
| Recent deployments | Railway public template API | `recentProjects` |
| Still-active deployments | Railway public template API | `activeProjects` |
| Template quality | Railway public template API | `health`, `supportHealthMetrics`, `isVerified`, `isApproved` |
| Repository discovery | GitHub traffic | views, unique cloners, and Railway referral traffic, treated as directional because the window is 14 days |
| B2 adoption | Backblaze attribution | storage and data moved by the `b2ai-oss-start` custom user agent |

Record the snapshot date, template code, published name, and listing URL with
each measurement. Deployment counts are leading indicators; attributed B2
usage is the objective. Do not claim conversion from deployments alone.
