#!/usr/bin/env node
/**
 * Agent instruction-surface drift check.
 *
 * Zero dependencies on purpose (node: builtins + local ./agent-docs modules):
 * `pnpm check:agent-docs` must run without `pnpm install`, and in any copy of
 * this starter kit — including one with no git work tree.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkBranding } from "./agent-docs/branding.mjs";
import { checkDocLinks } from "./agent-docs/doc-links.mjs";
import { checkEnvIgnores } from "./agent-docs/env-ignore.mjs";
import { checkInstructionTrustBoundary } from "./agent-docs/instruction-trust.mjs";
import { headings, sectionBody } from "./agent-docs/markdown.mjs";
import { checkGateClaims } from "./agent-docs/workflow.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];
const skips = [];

/** Failure detail is mandatory where a value is compared: expected vs actual. */
function check(condition, message, detail) {
  if (condition) {
    passes.push(message);
    return true;
  }

  failures.push(detail ? `${message} — ${detail}` : message);
  return false;
}

function repoPath(relativePath) {
  return join(REPO_ROOT, relativePath);
}

/**
 * @returns {string|null} the contents, or null when the file is missing *or*
 * empty — both are failures. readFileSync returns "" for a 0-byte file too, so
 * a truthiness guard let an empty file pass its `exists` assertion and then
 * silently skip its entire check group.
 */
function readText(relativePath) {
  const absolutePath = repoPath(relativePath);
  const exists = check(
    existsSync(absolutePath),
    `${relativePath} exists`,
    `expected a readable file at ${relativePath}, found nothing`,
  );
  const text = exists ? readFileSync(absolutePath, "utf8") : "";
  const nonEmpty =
    exists &&
    check(
      text.trim() !== "",
      `${relativePath} is not empty`,
      `expected a non-empty file at ${relativePath}, actual ${text.length} bytes`,
    );

  return nonEmpty ? text : null;
}

/** "never", "do/must not", "don't", "no", "avoid", "forbidden", "prohibited". */
const PROHIBITION =
  /\bnever\b|\bnot\b|n't\b|\bno\b|\bavoid\b|\bforbidden\b|\bprohibited\b/;

/**
 * True when one statement (list item or sentence) of `body` names one of
 * `needles` *and* forbids something. Both in the *same* statement is the point:
 * one sentence stating the opposite rule used to satisfy the whole table.
 */
function forbids(body, needles) {
  return body
    .split(/\r?\n|(?<=[.!?;])\s+/)
    .map((part) => part.toLowerCase())
    .some(
      (part) =>
        PROHIBITION.test(part) && needles.some((needle) => part.includes(needle)),
    );
}

const agents = readText("AGENTS.md");
const readme = readText("README.md");
const devWorkflows = readText("docs/dev-workflows.md");
const security = readText("docs/SECURITY.md");
const ci = readText(".github/workflows/ci.yml");

// --- AGENTS.md: the canonical surface ------------------------------------

if (agents) {
  const { size } = statSync(repoPath("AGENTS.md"));
  const lineCount = agents.trimEnd().split(/\r?\n/).length;

  check(size >= 1_000, "AGENTS.md is not unexpectedly small", `expected >= 1000 bytes, actual ${size}`);
  check(size <= 20_000, "AGENTS.md stays under 20 KB", `expected <= 20000 bytes, actual ${size}`);
  check(lineCount <= 250, "AGENTS.md stays under 250 lines", `expected <= 250 lines, actual ${lineCount}`);

  // AGENTS.md is canonical here; docs/SECURITY.md links to it (checked below).
  const secretRule = sectionBody(agents, /secret handling/i);

  if (
    check(
      secretRule !== null,
      'AGENTS.md has a "Secret Handling" section',
      "expected a heading containing `Secret Handling`, found none",
    )
  ) {
    const actual = JSON.stringify(secretRule.trim());

    for (const [label, needles] of [
      ["`.env` / env files", [".env", "dotenv", "env file"]],
      ["credentials", ["credential"]],
      ["API keys", ["api key", "api-key"]],
      ["printing or exposing them", ["print", "expose", "echo", "reveal"]],
      ["a leak surface (logs, screenshots, chat, commits)", ["log", "screenshot", "chat", "commit", "report"]],
    ]) {
      check(
        forbids(secretRule, needles),
        `AGENTS.md secret-handling rule forbids ${label}`,
        `expected one of ${JSON.stringify(needles)} in the same statement as a prohibition (never / do not / …), actual section text: ${actual}`,
      );
    }
  }

  const instructionTrust = checkInstructionTrustBoundary(agents);
  passes.push(...instructionTrust.passes);
  failures.push(...instructionTrust.failures);
}

// --- docs/SECURITY.md defers to the canonical rule -----------------------
// The pointer must be an anchored link whose target heading really exists, so
// renumbering the section breaks it loudly instead of quietly landing the
// reader at the top of AGENTS.md.

if (security && agents) {
  // Scan every ../AGENTS.md#anchor link, not just the first: SECURITY.md now
  // carries more than one (e.g. Instruction Authority), so requiring the *first*
  // to be secret-handling would break on a reorder even while the anchor is fine.
  const anchors = [...security.matchAll(/\(\.\.\/AGENTS\.md#([\w-]+)\)/g)].map((match) => match[1]);
  const agentHeadings = headings(agents);
  const secretHeading = agentHeadings.find((heading) => /secret handling/i.test(heading.text));
  const resolvesToSecretHandling =
    secretHeading !== undefined && anchors.includes(secretHeading.anchor);

  if (
    check(
      anchors.length > 0,
      "docs/SECURITY.md links into AGENTS.md by anchor",
      "expected a link like [AGENTS.md §12 — Secret Handling](../AGENTS.md#12-secret-handling), actual: no anchored AGENTS.md link",
    )
  ) {
    check(
      resolvesToSecretHandling,
      "docs/SECURITY.md anchors the AGENTS.md secret-handling heading",
      `expected one ../AGENTS.md#… link to resolve to the "Secret Handling" heading (anchor ${secretHeading ? `#${secretHeading.anchor}` : "not found"}), actual SECURITY.md anchors: ${JSON.stringify(anchors)}`,
    );
  }
}

// --- cross-agent shims: thin pointers, never copies ----------------------

for (const shimPath of ["CLAUDE.md", "GEMINI.md", ".github/copilot-instructions.md"]) {
  const absolutePath = repoPath(shimPath);

  // existsSync, not truthiness of the contents: a 0-byte shim used to be
  // treated as "missing" and silently skipped the pointer assertion below.
  if (
    !check(
      existsSync(absolutePath),
      `${shimPath} exists`,
      `expected a shim pointing at AGENTS.md, found nothing at ${shimPath}`,
    )
  ) {
    continue;
  }

  const { size } = statSync(absolutePath);
  const shim = readFileSync(absolutePath, "utf8");
  const lineCount = shim.trimEnd().split(/\r?\n/).length;

  check(size > 0, `${shimPath} is not empty`, `expected > 0 bytes, actual ${size}`);
  check(
    shim.includes("AGENTS.md"),
    `${shimPath} points to AGENTS.md`,
    `expected the text "AGENTS.md", actual content: ${JSON.stringify(shim.trim().slice(0, 200))}`,
  );
  check(size <= 1_000, `${shimPath} stays under 1 KB`, `expected <= 1000 bytes, actual ${size}; keep it a thin pointer`);
  check(lineCount <= 20, `${shimPath} stays under 20 lines`, `expected <= 20 lines, actual ${lineCount}; keep it a thin pointer`);
}

// --- verify gates: package.json, CI, and the command docs ----------------
// All three live in ./agent-docs/workflow.mjs. A substring grep over ci.yml was
// satisfied by ci.yml's own header comment, so deleting a job left the guard
// green; the gate *set* (never the literal chain) is what is asserted.

const gateClaims = checkGateClaims(readText("package.json"), ci, {
  "AGENTS.md": agents,
  "README.md": readme,
  "docs/dev-workflows.md": devWorkflows,
});

passes.push(...gateClaims.passes);
failures.push(...gateClaims.failures);

// --- env files -----------------------------------------------------------
// `pnpm run setup` copies .env.example to .env, so the file must exist:
// asserting an ignore pattern alone still passed with .env.example deleted.

check(
  existsSync(repoPath(".env.example")),
  ".env.example exists for setup (scripts/setup.mjs copies it to .env)",
  "expected .env.example at the repo root, found nothing",
);

const envIgnores = checkEnvIgnores(REPO_ROOT);

if (envIgnores.skip) {
  skips.push(`.env ignore checks (${envIgnores.skip})`);
} else {
  passes.push(...envIgnores.passes);
  failures.push(...envIgnores.failures);

  // Paths git could not answer for are surfaced one by one, so partial
  // coverage is visible rather than passing as if it were full coverage.
  for (const path of envIgnores.unevaluated) {
    skips.push(`.env ignore check for ${path}`);
  }
}

// --- Vercel deploy button: a whole-app contract or none ------------------
// A deploy button is optional (a fork may drop it). But IF the README ships a
// Vercel button, it must deploy the WHOLE app — never a partial slice — and be
// backed by the versioned delivery contract. Two shapes are valid: a single
// project whose root vercel.json declares both the `web` and `api` services
// (Vercel Services, one origin), or two buttons that each carry a
// root-directory covering one Project (the separate-origins alternative).

if (readme && /vercel\.com\/new\/clone/.test(readme)) {
  check(
    existsSync(repoPath("infra/vercel/README.md")),
    "Vercel deploy button is backed by infra/vercel/README.md",
    "README ships a Vercel deploy button but the delivery contract infra/vercel/README.md is missing",
  );

  let servicesCoverWebAndApi = false;
  const rootVercelJson = existsSync(repoPath("vercel.json"))
    ? readFileSync(repoPath("vercel.json"), "utf8")
    : "";
  try {
    const services = JSON.parse(rootVercelJson).services ?? {};
    servicesCoverWebAndApi = Boolean(services.web && services.api);
  } catch {
    servicesCoverWebAndApi = false;
  }

  const rootDirs = [...readme.matchAll(/root-directory=([^&\s)]+)/g)].map((match) =>
    decodeURIComponent(match[1]),
  );

  if (servicesCoverWebAndApi) {
    passes.push(
      "Vercel single-project button is backed by a root vercel.json declaring web + api services",
    );
  } else {
    // No services vercel.json → must be the two-Project button model instead.
    for (const rootDir of ["apps/web", "services/api"]) {
      check(
        rootDirs.includes(rootDir),
        `Vercel button covers the ${rootDir} Project`,
        `expected a root vercel.json declaring web+api services, or a deploy button with root-directory=${rootDir}; actual root dirs: ${JSON.stringify(rootDirs)}`,
      );
    }
  }
}

// --- internal Markdown links ---------------------------------------------
// Only the SECURITY.md -> AGENTS.md anchor above was ever verified, so every
// other cross-doc anchor could rot in silence: GitHub serves the file and lands
// the reader at the top. See ./agent-docs/doc-links.mjs.

const docLinks = checkDocLinks(REPO_ROOT);
passes.push(...docLinks.passes);
failures.push(...docLinks.failures);
skips.push(...docLinks.skips);

// --- branding / identity alignment ---------------------------------------
// The starter is cloned and rebranded; these assert every identity surface
// derives from one display name (app-config.ts) and one B2 attribution token,
// so a rebrand cannot leave a surface behind. See ./agent-docs/branding.mjs.

const branding = checkBranding(REPO_ROOT);
passes.push(...branding.passes);
failures.push(...branding.failures);
skips.push(...branding.skips);

// --- report --------------------------------------------------------------

for (const skip of skips) {
  console.log(`SKIPPED: ${skip}`);
}

if (failures.length > 0) {
  console.error("agent-docs check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

const skipNote = skips.length > 0 ? `, ${skips.length} skipped` : "";
console.log(`agent-docs check passed (${passes.length} checks${skipNote})`);
