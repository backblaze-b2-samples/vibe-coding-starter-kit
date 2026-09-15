/**
 * Generated regions of AGENTS.md.
 *
 * This file is the tightest budget in the repo: `pnpm check:agent-docs` caps
 * it at 250 lines and 20 KB, and `scripts/gen-docs.mjs` refuses to write an
 * over-budget result rather than letting the next gate catch it. Keep every
 * region here terse, and never buy space by dropping a region.
 *
 * Only the four mechanical surfaces are generated: the repository map, the
 * command index, and the two doc tables. The invariants, the quality bar, the
 * enforcement table and the agent workflow are hand-written rules.
 */
import { commandFence } from "./commands.mjs";
import { table } from "./context.mjs";

const TARGET_MAP = {
  vercel: "infra/vercel/      Vercel deployment contract",
  railway:
    "infra/railway/     Railway delivery contract (per-service railway.json at their service roots)",
};

function repositoryMap(ctx) {
  return [
    "```",
    "apps/web/          Next.js frontend (App Router, Tailwind, shadcn/ui)",
    "services/api/      FastAPI backend (layered: types/config/repo/service/runtime)",
    "packages/shared/   Shared TypeScript types, generated from the API contract",
    "docs/              System of record (features, workflows, security, reliability)",
    "docs/exec-plans/   Execution plans, tech debt, and sample.json (the gen:docs input)",
    "scripts/gen/       Generator policy: API naming, sample-manifest schema",
    ...ctx.deployment_targets.map((target) => TARGET_MAP[target] ?? `infra/${target}/`),
    "```",
  ].join("\n");
}

const DOC_UPDATE_ROWS = [
  ["Feature logic, inputs, outputs, tests", "`docs/features/<feature>.md`"],
  ["User journeys", "`docs/app-workflows.md` (headings and `See:` links come from `pnpm gen:docs`)"],
  ["System layout, deployments", "`ARCHITECTURE.md`"],
  ["Dev process, command index, releases", "`docs/dev-workflows.md`"],
  ["Testing, verification gates, CI, dependency locks", "`docs/verification.md`"],
  ["Frontend conventions, screens, data fetching", "`docs/frontend-conventions.md`"],
  ["Setup or scope changes", "`README.md`"],
  ["Security changes", "`docs/SECURITY.md`"],
  [
    "Agent instruction surface (rules, a new agent shim)",
    "`AGENTS.md` + the shims (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) + register it in `scripts/check-agent-docs.mjs`",
  ],
  ["Reliability changes", "`docs/RELIABILITY.md`"],
  ["Routes, request/response shapes", "the router and Pydantic model, then `pnpm contract:export && pnpm gen:api`"],
  ["App name, features, env vars, screenshots", "`docs/exec-plans/sample.json`, then `pnpm gen:docs`"],
  ["Active work plans", "`docs/exec-plans/active/`"],
  ["Known tech debt", "`docs/exec-plans/tech-debt-tracker.md`"],
];

function docUpdateMapping() {
  return table(["Change Type", "Update Location"], DOC_UPDATE_ROWS);
}

const DOC_MAP_ROWS = [
  ["System layout, data flows, boundaries", "[ARCHITECTURE.md](ARCHITECTURE.md)"],
  ["Feature docs", "[docs/features/](docs/features/)"],
  ["User journeys", "[docs/app-workflows.md](docs/app-workflows.md)"],
  ["Engineering workflows, command index, releases", "[docs/dev-workflows.md](docs/dev-workflows.md)"],
  ["What each gate checks; failure recovery", "[docs/verification.md](docs/verification.md)"],
  ["Frontend conventions and data fetching", "[docs/frontend-conventions.md](docs/frontend-conventions.md)"],
  ["Security principles", "[docs/SECURITY.md](docs/SECURITY.md)"],
  ["Reliability expectations", "[docs/RELIABILITY.md](docs/RELIABILITY.md)"],
  ["The API contract itself", "[docs/api/openapi.json](docs/api/openapi.json)"],
  ["Execution plans", "[docs/exec-plans/](docs/exec-plans/)"],
  ["Tech debt", "[docs/exec-plans/tech-debt-tracker.md](docs/exec-plans/tech-debt-tracker.md)"],
];

function docMap(ctx) {
  const rows = [...DOC_MAP_ROWS];

  for (const target of ctx.deployment_targets) {
    rows.push([
      `Deploying to ${target}`,
      `[infra/${target}/README.md](infra/${target}/README.md)`,
    ]);
  }

  return table(["Topic", "Location"], rows);
}

export const agentsDoc = {
  file: "AGENTS.md",
  regions: {
    "agents-repo-map": repositoryMap,
    "agents-commands": () => commandFence(),
    "agents-doc-update-mapping": docUpdateMapping,
    "agents-doc-map": docMap,
  },
};
