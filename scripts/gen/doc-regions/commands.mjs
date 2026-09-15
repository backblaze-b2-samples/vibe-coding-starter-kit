/**
 * The command index, declared once.
 *
 * Three surfaces have to name the same commands — AGENTS.md, README.md and
 * docs/dev-workflows.md — and `scripts/agent-docs/workflow.mjs` fails the
 * build when one of them forgets. Two of those three are generated from this
 * list, so the duplication is mechanical rather than remembered.
 *
 * `script` must be a real key in package.json `scripts`; the generator checks.
 * `group` buckets the AGENTS.md fence. `readme` is the longer description the
 * README's table wants, and its presence is also what puts the command in
 * that table — the README lists the handful reached for daily, not all of them.
 */
export const COMMANDS = [
  {
    script: "setup",
    invoke: "pnpm run setup",
    group: "Run",
    short: "idempotent cold-start setup (.env copy, deps, venv)",
    readme:
      "One-time cold start: copy `.env.example` → `.env` (only if missing), install workspace deps, create the backend venv, install locked API deps",
  },
  {
    script: "doctor",
    invoke: "pnpm run doctor",
    group: "Run",
    short: "preflight environment check (also runs before pnpm dev)",
  },
  {
    script: "dev",
    invoke: "pnpm dev",
    group: "Run",
    short: "start both frontend and backend",
    readme: "Start frontend + backend (runs the `pnpm run doctor` preflight first)",
  },
  { script: "dev:web", invoke: "pnpm dev:web", group: "Run", short: "frontend only" },
  { script: "dev:api", invoke: "pnpm dev:api", group: "Run", short: "backend only" },
  {
    script: "wait-ready",
    invoke: "pnpm wait-ready",
    group: "Run",
    short: "block until web + API answer, then exit (no sleep/curl polling)",
    readme:
      "Block until the running web + API answer, print one line, exit 0/1 — use instead of sleeping before driving the app",
  },
  {
    script: "contract:export",
    invoke: "pnpm contract:export",
    group: "Generate",
    short: "export deterministic FastAPI OpenAPI JSON",
    readme: "Export the FastAPI OpenAPI contract into `docs/api/openapi.json`",
  },
  {
    script: "contract:check",
    invoke: "pnpm contract:check",
    group: "Generate",
    short: "check OpenAPI artifact + frontend client routes",
    readme: "Verify the exported contract and the generated client routes agree, both ways",
  },
  {
    script: "gen:api",
    invoke: "pnpm gen:api",
    group: "Generate",
    short: "regenerate shared types, client routes and query keys",
    readme:
      "Regenerate the shared types, the client route registry and the query-key factory from the exported contract",
  },
  {
    script: "gen:docs",
    invoke: "pnpm gen:docs",
    group: "Generate",
    short: "regenerate the doc regions from docs/exec-plans/sample.json",
    readme:
      "Regenerate the marker-delimited doc regions from `docs/exec-plans/sample.json`",
  },
  {
    script: "gen:check",
    invoke: "pnpm gen:check",
    group: "Generate",
    short: "fail if any generated file or doc region is stale",
    readme: "Fail if any generated file or doc region is stale (first step of `pnpm verify:web`)",
  },
  {
    script: "check:agent-docs",
    invoke: "pnpm check:agent-docs",
    group: "Test & Lint",
    short: "agent instruction/documentation drift check",
  },
  {
    script: "verify",
    invoke: "pnpm verify",
    group: "Test & Lint",
    short: "credential-free canonical non-live pre-PR suite",
    readme:
      "Credential-free pre-PR suite — runs `check:agent-docs`, `verify:api`, then `verify:web`",
  },
  {
    script: "verify:api",
    invoke: "pnpm verify:api",
    group: "Test & Lint",
    short: "backend half of verify (lint, tests, structure)",
  },
  {
    script: "verify:web",
    invoke: "pnpm verify:web",
    group: "Test & Lint",
    short: "frontend half of verify (generator drift, lint, unit tests, typecheck + build)",
  },
  {
    script: "verify:full",
    invoke: "pnpm verify:full",
    group: "Test & Lint",
    short: "doctor + verify + Playwright E2E (requires browser + live local app prerequisites)",
    readme:
      "`pnpm verify` plus Playwright E2E; needs a live local stack, real `.env`, a free web port, and Chromium",
  },
  { script: "lint", invoke: "pnpm lint", group: "Test & Lint", short: "frontend lint (eslint)" },
  {
    script: "typecheck",
    invoke: "pnpm typecheck",
    group: "Test & Lint",
    short: "frontend TypeScript check without producing a build",
  },
  { script: "build", invoke: "pnpm build", group: "Test & Lint", short: "frontend type check + build" },
  {
    script: "test:web",
    invoke: "pnpm test:web",
    group: "Test & Lint",
    short: "frontend unit tests (vitest)",
  },
  { script: "lint:api", invoke: "pnpm lint:api", group: "Test & Lint", short: "backend lint (ruff)" },
  {
    script: "test:api",
    invoke: "pnpm test:api",
    group: "Test & Lint",
    short: "backend tests (pytest)",
  },
  {
    script: "test:live:b2",
    invoke: "pnpm test:live:b2",
    group: "Test & Lint",
    short: "opt-in real B2 connectivity test (requires explicit flag)",
  },
  {
    script: "check:structure",
    invoke: "pnpm check:structure",
    group: "Test & Lint",
    short: "structural boundary tests",
  },
  {
    script: "test:e2e",
    invoke: "pnpm test:e2e",
    group: "Test & Lint",
    short: "this app's own Playwright smoke suite (project: chromium)",
  },
  {
    script: "test:verify",
    invoke: "pnpm test:verify",
    group: "Test & Lint",
    short: "throwaway app verification specs in apps/web/e2e/verify/ (project: verify)",
    readme:
      "Run throwaway verification specs from `apps/web/e2e/verify/` against the app, with the shared browser fixtures",
  },
];

const GROUPS = ["Run", "Generate", "Test & Lint"];

/** The AGENTS.md fence: grouped, aligned, one line per command. */
export function commandFence() {
  const width = Math.max(...COMMANDS.map((command) => command.invoke.length)) + 1;
  const blocks = GROUPS.map((group) => {
    const rows = COMMANDS.filter((command) => command.group === group).map(
      (command) => `${command.invoke.padEnd(width)} # ${command.short}`,
    );
    return [`# ${group}`, ...rows].join("\n");
  });

  return ["```bash", blocks.join("\n\n"), "```"].join("\n");
}

/** The README table: only the commands reached for day to day. */
export function commandTable() {
  return COMMANDS.filter((command) => command.readme).map((command) => [
    `\`${command.invoke}\``,
    command.readme,
  ]);
}
