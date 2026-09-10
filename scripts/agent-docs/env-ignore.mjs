/**
 * `.env` ignore coverage for `scripts/check-agent-docs.mjs`.
 *
 * Zero dependencies (node: builtins only). Three-state on purpose:
 * ignored / not ignored / could-not-evaluate (thrown). "Not ignored" is never
 * reused for an evaluation error — a swallowed error used to make the negated
 * ".env.example remains trackable" assertion pass without evaluating anything.
 *
 * Evaluation is per path, never per group: `git check-ignore` fails for one
 * path at a time (a symlinked `apps/web` makes only `apps/web/.env.local`
 * unanswerable), so a group-wide try/catch used to discard every result
 * collected before the throw and report a clean skip instead.
 */
import { spawnSync } from "node:child_process";

/** Real env files: must be ignored by a `.gitignore` tracked in this repo. */
const MUST_BE_IGNORED = [
  ".env",
  ".env.local",
  ".env.production",
  "services/api/.env",
  "apps/web/.env.local",
];

/** Example/template env files: must stay trackable anywhere in the tree. */
const MUST_BE_TRACKABLE = [
  ".env.example",
  ".env.template",
  "apps/web/.env.local.example",
  "services/api/.env.example",
];

class IgnoreUnavailableError extends Error {}

/** A repo-tracked `.gitignore` — not `.git/info/exclude`, not a global file. */
function isRepoIgnoreSource(source) {
  const normalized = source.replace(/\\/g, "/");

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized === ".git" ||
    normalized.startsWith(".git/")
  ) {
    return false;
  }

  return normalized === ".gitignore" || normalized.endsWith("/.gitignore");
}

/**
 * @returns {{ignored: boolean, why: string}}
 * @throws {IgnoreUnavailableError} when git cannot answer at all.
 */
function evaluateIgnore(repoRoot, relativePath) {
  // core.excludesFile=/dev/null so a developer's global excludes can't satisfy
  // the check; --verbose so the matching source file is reported.
  const result = spawnSync(
    "git",
    [
      "-c",
      "core.excludesFile=/dev/null",
      "check-ignore",
      "--verbose",
      "--no-index",
      "--",
      relativePath,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  if (result.error) {
    throw new IgnoreUnavailableError(
      result.error.code === "ENOENT"
        ? "git is not on PATH"
        : `git could not be run: ${result.error.message}`,
    );
  }

  if (result.status === 1) {
    return { ignored: false, why: "no ignore pattern matches it" };
  }

  if (result.status !== 0) {
    // stderr is captured (not "ignore"d) so the real cause is reportable.
    const stderr = (result.stderr || "").trim().split(/\r?\n/)[0];
    throw new IgnoreUnavailableError(
      /not a git repository/i.test(stderr)
        ? "not a git work tree"
        : `git check-ignore exited ${result.status}: ${stderr || "no output"}`,
    );
  }

  // --verbose prints `<source>:<line>:<pattern>\t<path>`.
  const line = (result.stdout || "").split(/\r?\n/)[0] || "";
  const match = /^(.*):(\d+):(.*)\t/.exec(line);

  if (!match) {
    throw new IgnoreUnavailableError(
      `unparseable git check-ignore --verbose output: ${JSON.stringify(line)}`,
    );
  }

  const [, source, lineNumber, pattern] = match;
  const at = `${source}:${lineNumber}:${pattern}`;

  if (pattern.startsWith("!")) {
    return { ignored: false, why: `re-included by ${at}` };
  }

  if (!isRepoIgnoreSource(source)) {
    return {
      ignored: false,
      why: `only matched by ${at}, which is not a repo-tracked .gitignore`,
    };
  }

  return { ignored: true, why: `ignored by ${at}` };
}

/**
 * Runs the ignore checks path by path.
 *
 * @returns {{passes: string[], failures: string[], skip: string|null,
 * unevaluated: string[]}} — `skip` is set only when *no* path could be
 * evaluated (e.g. no git work tree): then the group was abandoned wholesale,
 * with no passes, no failures and no exit code. Otherwise every evaluable path
 * is reported, and `unevaluated` lists the individual paths git could not
 * answer for, so partial coverage is visible instead of silent.
 */
export function checkEnvIgnores(repoRoot) {
  const passes = [];
  const failures = [];
  const unevaluated = [];
  const reasons = new Set();

  for (const [paths, mustBeIgnored] of [
    [MUST_BE_IGNORED, true],
    [MUST_BE_TRACKABLE, false],
  ]) {
    for (const path of paths) {
      let ignored;
      let why;

      try {
        ({ ignored, why } = evaluateIgnore(repoRoot, path));
      } catch (error) {
        if (!(error instanceof IgnoreUnavailableError)) {
          throw error;
        }

        unevaluated.push(`${path} (${error.message})`);
        reasons.add(error.message);
        continue;
      }

      if (mustBeIgnored && ignored) {
        passes.push(`${path} is ignored by a repo-tracked .gitignore`);
      } else if (mustBeIgnored) {
        failures.push(
          `${path} is ignored by a repo-tracked .gitignore — expected ignored, actual not ignored (${why})`,
        );
      } else if (ignored) {
        failures.push(
          `${path} remains trackable — expected trackable, actual ignored (${why}); add a negation pattern after the ignore patterns`,
        );
      } else {
        passes.push(`${path} remains trackable`);
      }
    }
  }

  if (unevaluated.length === MUST_BE_IGNORED.length + MUST_BE_TRACKABLE.length) {
    return {
      passes: [],
      failures: [],
      skip: [...reasons].join("; "),
      unevaluated: [],
    };
  }

  return { passes, failures, skip: null, unevaluated };
}
