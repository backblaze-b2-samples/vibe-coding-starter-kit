/**
 * Internal Markdown link integrity for `scripts/check-agent-docs.mjs`.
 *
 * Zero dependencies (node: builtins + ./markdown.mjs). Every relative Markdown
 * link is resolved against the filesystem, and every `#anchor` against the
 * target file's real headings. Splitting a doc used to break inbound anchors
 * silently: GitHub serves the file and lands the reader at the top, so a link
 * to a section that no longer exists reads as working.
 *
 * External links (`http`, `mailto`) are never fetched — this check stays
 * offline and deterministic. Non-Markdown targets are checked for existence
 * only, since anchors into them are not headings.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { anchorOf, headings } from "./markdown.mjs";

/** Generated, vendored, or virtual-env trees: never authored docs. */
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".pytest_cache",
  ".ruff_cache",
  ".turbo",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

/** `](target)`, tolerating an optional "title" and an `<…>` wrapped target. */
const LINK = /\]\(\s*<?([^)>\s]+)>?(?:\s+[^)]*)?\)/g;

/**
 * Repo-relative Markdown paths in deterministic (sorted) order, so failures
 * are reported in the same sequence on every machine.
 */
function markdownFiles(root, directory = root, found = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const absolute = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        markdownFiles(root, absolute, found);
      }

      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      found.push(relative(root, absolute).split(sep).join("/"));
    }
  }

  return found;
}

/**
 * Fenced blocks and inline code blanked out, line count preserved so reported
 * line numbers stay true. A shell example containing `](…)` is not a link.
 */
function withoutCode(markdown) {
  let fence = null;

  return markdown.split(/\r?\n/).map((line) => {
    const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1][0] ?? null;

    if (mark) {
      fence = fence === mark ? null : (fence ?? mark);
      return "";
    }

    return fence === null ? line.replace(/`+[^`\n]*`+/g, "") : "";
  });
}

/**
 * Every anchor GitHub would serve for `markdown`, including the `-1`, `-2`
 * suffixes it appends to repeated heading text.
 */
function anchorsOf(markdown) {
  const counts = new Map();
  const anchors = new Set();

  for (const { text } of headings(markdown)) {
    const base = anchorOf(text);
    const seen = counts.get(base) ?? 0;

    counts.set(base, seen + 1);
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
  }

  return anchors;
}

/**
 * Asserts every relative Markdown link resolves to a real file, and every
 * anchor to a real heading in that file.
 *
 * @param {string} repoRoot absolute path to the repository root
 * @returns {{passes: string[], failures: string[], skips: string[]}}
 */
export function checkDocLinks(repoRoot) {
  const failures = [];
  const anchorCache = new Map();
  let files;

  try {
    files = markdownFiles(repoRoot);
  } catch (error) {
    return {
      passes: [],
      failures: [],
      skips: [`internal Markdown link checks (cannot read the tree: ${error.message})`],
    };
  }

  if (files.length === 0) {
    return {
      passes: [],
      failures: [],
      skips: ["internal Markdown link checks (no Markdown files found)"],
    };
  }

  const anchorsFor = (path) => {
    if (!anchorCache.has(path)) {
      anchorCache.set(path, anchorsOf(readFileSync(join(repoRoot, path), "utf8")));
    }

    return anchorCache.get(path);
  };

  let checked = 0;

  for (const path of files) {
    const lines = withoutCode(readFileSync(join(repoRoot, path), "utf8"));

    lines.forEach((line, index) => {
      const at = `${path}:${index + 1}`;

      for (const [, target] of line.matchAll(LINK)) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) {
          continue; // http(s), mailto, tel, protocol-relative — never fetched.
        }

        const [rawPath, ...anchorParts] = target.split("#");
        const anchor = anchorParts.join("#");
        let decoded;

        try {
          decoded = decodeURIComponent(rawPath);
        } catch {
          decoded = rawPath;
        }

        // Same-file anchor (`](#section)`): resolve against this file.
        const targetPath = decoded === "" ? path : null;
        const absolute =
          targetPath === null
            ? resolve(repoRoot, dirname(path), decoded)
            : join(repoRoot, path);
        const repoRelative =
          targetPath ?? relative(repoRoot, absolute).split(sep).join("/");

        if (repoRelative.startsWith("../")) {
          continue; // Outside the repo: nothing here can vouch for it.
        }

        checked += 1;

        let stats;

        try {
          stats = statSync(absolute);
        } catch {
          failures.push(
            `${at} links to ${target} — expected a file at ${repoRelative}, found nothing`,
          );
          continue;
        }

        if (anchor === "" || !stats.isFile() || !repoRelative.toLowerCase().endsWith(".md")) {
          continue; // No anchor, or a directory / non-Markdown target.
        }

        const anchors = anchorsFor(repoRelative);

        if (!anchors.has(anchor)) {
          failures.push(
            `${at} links to ${target} — expected a heading anchored #${anchor} in ${repoRelative}, actual anchors: ${JSON.stringify([...anchors])}`,
          );
        }
      }
    });
  }

  return {
    passes: [
      `internal Markdown links resolve (${checked} links across ${files.length} files)`,
    ],
    failures,
    skips: [],
  };
}
