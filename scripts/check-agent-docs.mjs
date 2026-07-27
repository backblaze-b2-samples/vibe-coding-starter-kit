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

import { checkEnvIgnores } from "./agent-docs/env-ignore.mjs";
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

/**
 * Prose headings in document order. Lines inside a fenced code block are never
 * headings: a `# comment` in a shell example used to be read as one, truncating
 * the section body above it.
 */
function headings(markdown) {
  const found = [];
  let fence = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1][0] ?? null;

    if (mark) {
      // A fence only closes with the character that opened it.
      fence = fence === mark ? null : (fence ?? mark);
      return;
    }

    const heading = fence === null ? /^(#{1,6})\s+(.*)$/.exec(line) : null;
    const text = heading ? heading[2].trim() : "";

    if (heading) {
      found.push({ index, level: heading[1].length, text, anchor: anchorOf(text) });
    }
  });

  return found;
}

/** GitHub heading anchor: `## 12. Secret Handling` -> `12-secret-handling`. */
function anchorOf(headingText) {
  return headingText
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Body of the first `##`..`####` heading matching `headingPattern`. Matched by
 * heading text, not section number: numbering churns, the rule must not.
 */
function sectionBody(markdown, headingPattern) {
  const lines = markdown.split(/\r?\n/);
  const all = headings(markdown);
  const at = all.findIndex(
    ({ level, text }) => level >= 2 && level <= 4 && headingPattern.test(text),
  );

  if (at === -1) {
    return null;
  }

  const next = all.slice(at + 1).find((heading) => heading.level <= 4);

  return lines
    .slice(all[at].index + 1, next ? next.index : lines.length)
    .join("\n");
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
}

// --- docs/SECURITY.md defers to the canonical rule -----------------------
// The pointer must be an anchored link whose target heading really exists, so
// renumbering the section breaks it loudly instead of quietly landing the
// reader at the top of AGENTS.md.

if (security && agents) {
  const anchor = /\(\.\.\/AGENTS\.md#([\w-]+)\)/.exec(security)?.[1] ?? null;
  const agentHeadings = headings(agents);
  const target = agentHeadings.find((heading) => heading.anchor === anchor);

  if (
    check(
      anchor !== null,
      "docs/SECURITY.md links into AGENTS.md by anchor",
      "expected a link like [AGENTS.md §12 — Secret Handling](../AGENTS.md#12-secret-handling), actual: no anchored AGENTS.md link",
    )
  ) {
    check(
      target !== undefined && /secret handling/i.test(target.text),
      `docs/SECURITY.md anchor #${anchor} resolves to the AGENTS.md secret-handling heading`,
      `expected #${anchor} to match a heading containing "Secret Handling", actual AGENTS.md anchors: ${JSON.stringify(agentHeadings.map((heading) => heading.anchor))}`,
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
