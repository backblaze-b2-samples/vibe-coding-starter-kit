/**
 * Generated regions of README.md.
 *
 * Small on purpose. The README is the one document that gets rewritten
 * wholesale rather than edited, and a marker pair only survives an edit — so
 * the generated surface is kept to the parts that are pure transcription of
 * the manifest (identity, screenshots, credential names, the command table,
 * the deploy-button URL, the documentation map). Every argued section — quick
 * start, when to use / when not to use, why this storage, the FAQ — is
 * hand-written and never touched.
 */
import { commandTable } from "./commands.mjs";
import { table } from "./context.mjs";

const SIGNUP = "https://www.backblaze.com/sign-up/ai-cloud-storage";
const RAW_HOST = "https://raw.githubusercontent.com";

function header(ctx) {
  return [
    `# ${ctx.name}`,
    "",
    `${ctx.tagline} ${ctx.purpose}`,
    "",
    "Built for developers and AI coding agents: the scaffolding, the storage",
    "wiring and the agent-facing docs are already done, so you start on your",
    `app's own features instead of rebuilding the same shell. Storage is`,
    `**[Backblaze B2](${ctx.link(SIGNUP)})**, integrated through the S3-compatible API.`,
    "",
    "**What you get out of the box:**",
    `- Full-stack dashboard UI (${ctx.stack.web})`,
    ...ctx.features.map((feature) => `- ${feature.title} — ${feature.summary}`),
    `- Backend with a strict layered architecture and structural tests (${ctx.stack.api})`,
    "- Agent-optimized docs — your AI coding agent can read the repo and start contributing immediately",
  ].join("\n");
}

/**
 * Screenshots, and nothing at all when there are none.
 *
 * An empty `screenshots` array is the scaffolding case: a fresh app has not
 * taken its own screenshots yet and deletes the kit's, and an embed pointing
 * at a deleted PNG fails the doc-link check. So no embeds, no heading, and
 * (below) no `demo-image` on the deploy button.
 */
function screenshots(ctx) {
  const blocks = [];

  if (ctx.screenshots.length > 0) {
    blocks.push("## What it looks like", "");

    for (const shot of ctx.screenshots) {
      blocks.push(shot.caption, "", `![${shot.alt}](${shot.path})`, "");
    }
  }

  if (ctx.deploys("vercel")) {
    blocks.push(
      "> **Deploy your own in one click** → [Deploy to Vercel](#deploying-to-vercel). One project, one origin, no CORS to wire up.",
      "",
    );
  }

  return blocks.join("\n").trimEnd();
}

function credentials(ctx) {
  return [
    "1. **Create a bucket** and an **application key** with `Read and Write`",
    "   permission, then paste each value into `.env`:",
    ...ctx.requiredVars.map(
      (variable) => `   - \`${variable.name}\` — ${variable.note}`,
    ),
    "",
    "   B2 shows an application key once, at creation. The optional variables are",
    "   documented in `.env.example` and in the delivery runbooks.",
  ].join("\n");
}

function coreFeatures(ctx) {
  return ctx.features
    .map((feature) => `- [${feature.title}](${feature.doc}) — ${feature.summary}`)
    .join("\n");
}

function commands() {
  return table(["Command", "What it does"], commandTable());
}

function deployButton(ctx) {
  if (!ctx.deploys("vercel")) {
    return "_This app does not ship a one-click deploy button._";
  }

  const repoUrl = `https://github.com/${ctx.repo.org}/${ctx.repo.name}`;
  const params = [
    ["repository-url", repoUrl],
    ["project-name", ctx.slug],
    ["repository-name", ctx.slug],
    ["demo-title", ctx.name],
    ["demo-description", ctx.purpose],
  ];

  if (ctx.screenshots.length > 0) {
    params.push([
      "demo-image",
      `${RAW_HOST}/${ctx.repo.org}/${ctx.repo.name}/main/${ctx.screenshots[0].path}`,
    ]);
  }

  params.push(
    ["env", ctx.requiredVars.map((variable) => variable.name).join(",")],
    ["envDescription", "B2 credentials and bucket"],
    ["envLink", `${repoUrl}/blob/main/infra/vercel/README.md`],
  );

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?${query})`;
}

const DOC_MAP_ROWS = [
  ["[AGENTS.md](AGENTS.md)", "Agent table of contents — start here"],
  ["[ARCHITECTURE.md](ARCHITECTURE.md)", "System layout, layering, data flows"],
  ["[docs/design-system.md](docs/design-system.md)", "Design tokens, primitives, loader, error/empty states"],
  ["[docs/app-workflows.md](docs/app-workflows.md)", "User journeys"],
  ["[docs/dev-workflows.md](docs/dev-workflows.md)", "Engineering workflows, command index, releases"],
  ["[docs/verification.md](docs/verification.md)", "What each gate checks, and failure recovery"],
  ["[docs/frontend-conventions.md](docs/frontend-conventions.md)", "Frontend conventions, screens, data fetching"],
  ["[docs/SECURITY.md](docs/SECURITY.md)", "Security principles"],
  ["[docs/RELIABILITY.md](docs/RELIABILITY.md)", "Reliability expectations"],
  ["[docs/api/openapi.json](docs/api/openapi.json)", "The checked-in API contract the client seam is generated from"],
];

const TARGET_LABEL = { vercel: "Vercel deployment contract", railway: "Railway delivery contract" };

function documentationMap(ctx) {
  const rows = [
    DOC_MAP_ROWS[0],
    DOC_MAP_ROWS[1],
    ["[docs/features/](docs/features/)", `Feature docs (${ctx.features.map((feature) => feature.title.toLowerCase()).join(", ")})`],
    ...DOC_MAP_ROWS.slice(2),
    ...ctx.deployment_targets.map((target) => [
      `[infra/${target}/README.md](infra/${target}/README.md)`,
      TARGET_LABEL[target] ?? `${target} delivery contract`,
    ]),
    ["[docs/exec-plans/](docs/exec-plans/)", "Execution plans, tech debt, and the sample manifest"],
  ];

  return table(["Doc", "Purpose"], rows);
}

export const readmeDoc = {
  file: "README.md",
  regions: {
    "readme-header": header,
    "readme-screenshots": screenshots,
    "readme-credentials": credentials,
    "readme-core-features": coreFeatures,
    "readme-commands": commands,
    "readme-deploy-button": deployButton,
    "readme-doc-map": documentationMap,
  },
};
