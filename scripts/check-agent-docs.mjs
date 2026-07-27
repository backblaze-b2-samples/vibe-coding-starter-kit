#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];

function check(condition, message) {
  if (condition) {
    passes.push(message);
  } else {
    failures.push(message);
  }
}

function repoPath(relativePath) {
  return join(REPO_ROOT, relativePath);
}

function readText(relativePath) {
  const absolutePath = repoPath(relativePath);
  check(existsSync(absolutePath), `${relativePath} exists`);

  if (!existsSync(absolutePath)) {
    return "";
  }

  return readFileSync(absolutePath, "utf8");
}

function hasCommand(text, command) {
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9:_-])${escaped}(?=$|[^A-Za-z0-9:_-])`).test(
    text,
  );
}

function gitIgnores(relativePath) {
  const result = spawnSync("git", [
    "check-ignore",
    "--quiet",
    "--no-index",
    relativePath,
  ], {
    cwd: REPO_ROOT,
    stdio: "ignore",
  });

  if (result.status === 0) {
    return true;
  }

  if (result.status === 1) {
    return false;
  }

  failures.push(`git check-ignore could not evaluate ${relativePath}`);
  return false;
}

const agents = readText("AGENTS.md");
const readme = readText("README.md");
const devWorkflows = readText("docs/dev-workflows.md");
const ci = readText(".github/workflows/ci.yml");

if (agents) {
  const stats = statSync(repoPath("AGENTS.md"));
  const lineCount = agents.trimEnd().split(/\r?\n/).length;

  check(stats.size >= 1_000, "AGENTS.md is not unexpectedly small");
  check(stats.size <= 20_000, "AGENTS.md stays under 20 KB");
  check(lineCount <= 250, "AGENTS.md stays under 250 lines");
  check(
    agents.includes(
      "Never print `.env`, credentials, or API keys in chat, logs, reports, commits, or screenshots.",
    ),
    "AGENTS.md contains the no-secret printing rule",
  );
}

for (const shimPath of [
  "CLAUDE.md",
  "GEMINI.md",
  ".github/copilot-instructions.md",
]) {
  const shim = readText(shimPath);

  if (!shim) {
    continue;
  }

  const stats = statSync(repoPath(shimPath));
  const lineCount = shim.trimEnd().split(/\r?\n/).length;

  check(shim.includes("AGENTS.md"), `${shimPath} points to AGENTS.md`);
  check(stats.size <= 1_000, `${shimPath} stays under 1 KB`);
  check(lineCount <= 20, `${shimPath} stays under 20 lines`);
  check(
    !shim.includes("## 1. Repository Map") &&
      !shim.includes("## 3. Architectural Invariants"),
    `${shimPath} does not duplicate full AGENTS.md rules`,
  );
}

const packageJson = JSON.parse(readText("package.json"));
const expectedScripts = {
  "check:agent-docs": "node scripts/check-agent-docs.mjs",
  verify: "pnpm check:agent-docs && pnpm verify:api && pnpm verify:web",
  "verify:api": "pnpm lint:api && pnpm test:api && pnpm check:structure",
  "verify:web": "pnpm lint && pnpm test:web && pnpm build",
  "verify:full": "pnpm doctor && pnpm verify && pnpm test:e2e",
};

for (const [scriptName, expectedCommand] of Object.entries(expectedScripts)) {
  check(
    packageJson.scripts?.[scriptName] === expectedCommand,
    `package.json script ${scriptName} matches the documented command chain`,
  );
}

for (const [surfacePath, surfaceText] of Object.entries({
  "AGENTS.md": agents,
  "README.md": readme,
  "docs/dev-workflows.md": devWorkflows,
})) {
  for (const command of [
    "pnpm check:agent-docs",
    "pnpm verify",
    "pnpm verify:api",
    "pnpm verify:web",
    "pnpm verify:full",
  ]) {
    check(hasCommand(surfaceText, command), `${surfacePath} documents ${command}`);
  }
}

for (const command of [
  "pnpm check:agent-docs",
  "pnpm verify:api",
  "pnpm verify:web",
]) {
  check(hasCommand(ci, command), `.github/workflows/ci.yml runs ${command}`);
  check(
    hasCommand(devWorkflows, command),
    `docs/dev-workflows.md describes CI running ${command}`,
  );
  check(hasCommand(agents, command), `AGENTS.md describes CI running ${command}`);
}

for (const ignoredPath of [
  ".env",
  ".env.local",
  ".env.production",
  "services/api/.env",
  "apps/web/.env.local",
]) {
  check(gitIgnores(ignoredPath), `${ignoredPath} is ignored`);
}

check(!gitIgnores(".env.example"), ".env.example remains trackable");

if (failures.length > 0) {
  console.error("agent-docs check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`agent-docs check passed (${passes.length} checks)`);
