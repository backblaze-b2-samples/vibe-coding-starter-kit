/**
 * Branding / identity drift checks for `scripts/check-agent-docs.mjs`.
 *
 * The starter kit is cloned and rebranded into new apps, and that rename step
 * is where identity silently drifts apart — one surface gets the new name, the
 * next keeps the old one. These checks fail loudly when that happens.
 *
 * Zero dependencies (node: builtins only) and no git dependency, matching the
 * rest of the checker: it must run in any copy of the starter, including one
 * with no work tree. None of the assertions hardcode the current name — they
 * check *derivation / consistency*, so they hold for the starter itself (all
 * "Vibe Coding Starter Kit") and for any rebranded clone (all the new name).
 *
 * Invariants:
 *  1. The FastAPI title derives from the frontend's single display name
 *     (`APP_NAME` in apps/web/src/lib/app-config.ts): `API_TITLE` must be
 *     `${APP_NAME} API`, both API and OpenAPI descriptions must mention it, and
 *     the shipped OpenAPI artifact must agree. main.py is the one display-name
 *     copy a rebrand forgets, because the frontend imports APP_NAME while Python
 *     cannot.
 *  2. The display name is not hardcoded in frontend source outside
 *     app-config.ts — components import the constant, so a rebrand touches
 *     exactly one frontend file.
 *  3. The B2 attribution token is one value across `user_agent_extra` (the
 *     mandatory custom user agent) and `utm_content` (the Backblaze marketing
 *     links): one sample identity, not several drifting copies.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/** Big or generated trees the scans never need to walk. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".venv",
  ".next",
  ".git",
  "dist",
  "build",
  "__pycache__",
  ".turbo",
  "coverage",
]);

/**
 * Absolute paths of files under `root` whose name ends in one of `exts`.
 * A missing root returns [] so an opportunistic scan never fails on a clone
 * that restructured its tree.
 */
function walk(root, exts) {
  if (!existsSync(root)) {
    return [];
  }

  const found = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          stack.push(join(dir, entry.name));
        }
      } else if (exts.some((ext) => entry.name.endsWith(ext))) {
        found.push(join(dir, entry.name));
      }
    }
  }

  return found;
}

function readOrNull(absolutePath) {
  try {
    return readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * @param {string} repoRoot absolute path to the repo root
 * @returns {{passes: string[], failures: string[], skips: string[]}}
 */
export function checkBranding(repoRoot) {
  const passes = [];
  const failures = [];
  const skips = [];
  const rel = (absolutePath) => relative(repoRoot, absolutePath);

  const record = (ok, message, detail) => {
    if (ok) {
      passes.push(message);
      return ok;
    }
    failures.push(detail ? `${message} — ${detail}` : message);
    return ok;
  };

  // --- canonical display name: apps/web/src/lib/app-config.ts -------------
  const appConfig = readOrNull(join(repoRoot, "apps/web/src/lib/app-config.ts"));
  if (appConfig === null) {
    // No frontend identity source -> nothing downstream to align against.
    skips.push("branding checks (apps/web/src/lib/app-config.ts not found)");
    return { passes, failures, skips };
  }

  const nameMatch = /export\s+const\s+APP_NAME\s*=\s*"([^"]+)"/.exec(appConfig);
  if (
    !record(
      nameMatch !== null,
      "branding: APP_NAME is defined in app-config.ts",
      'expected `export const APP_NAME = "..."` in apps/web/src/lib/app-config.ts',
    )
  ) {
    return { passes, failures, skips };
  }
  const appName = nameMatch[1];
  const expectedTitle = `${appName} API`;

  // --- 1. FastAPI title/description derive from APP_NAME -------------------
  const mainPy = readOrNull(join(repoRoot, "services/api/main.py"));
  if (mainPy === null) {
    skips.push("branding: API title check (services/api/main.py not found)");
  } else {
    const titleMatch = /API_TITLE\s*=\s*"([^"]+)"/.exec(mainPy);
    if (
      record(
        titleMatch !== null,
        "branding: main.py defines API_TITLE",
        'expected `API_TITLE = "..."` in services/api/main.py',
      )
    ) {
      record(
        titleMatch[1] === expectedTitle,
        "branding: main.py API_TITLE derives from APP_NAME",
        `expected "${expectedTitle}" (\`\${APP_NAME} API\`), actual "${titleMatch[1]}"`,
      );
    }

    const descBlock =
      /API_DESCRIPTION\s*=\s*\(([\s\S]*?)\)/.exec(mainPy) ??
      /API_DESCRIPTION\s*=\s*("[\s\S]*?")/.exec(mainPy);
    if (descBlock) {
      record(
        descBlock[1].includes(appName),
        "branding: main.py API_DESCRIPTION names the app",
        `expected the API_DESCRIPTION text to mention "${appName}"`,
      );
    }
  }

  // The shipped OpenAPI artifact must carry the same title (contract:export
  // keeps it in sync with main.py; this makes branding self-contained too).
  const openapiText = readOrNull(join(repoRoot, "docs/api/openapi.json"));
  if (openapiText === null) {
    skips.push(
      "branding: OpenAPI title check (docs/api/openapi.json not found)",
    );
  } else {
    let info = null;
    try {
      info = JSON.parse(openapiText).info ?? null;
    } catch {
      info = null;
    }

    if (
      record(
        info !== null,
        "branding: docs/api/openapi.json has a parseable info block",
        "expected a valid OpenAPI document with an `info` object",
      )
    ) {
      record(
        info.title === expectedTitle,
        "branding: OpenAPI info.title derives from APP_NAME",
        `expected "${expectedTitle}", actual ${JSON.stringify(info.title ?? null)}; run \`pnpm contract:export\` after editing main.py`,
      );
      record(
        typeof info.description === "string" &&
          info.description.includes(appName),
        "branding: OpenAPI info.description names the app",
        `expected info.description to mention "${appName}"`,
      );
    }
  }

  // --- 2. display name is not hardcoded in frontend source ----------------
  // Only the config file and its test may hold the literal; everything else
  // imports APP_NAME. Catches a rebrand that renamed app-config.ts but left a
  // stale (or a stray new) literal in a component.
  const allowLiteral = new Set([
    join(repoRoot, "apps/web/src/lib/app-config.ts"),
    join(repoRoot, "apps/web/src/lib/app-config.test.ts"),
  ]);
  const strays = walk(join(repoRoot, "apps/web/src"), [".ts", ".tsx"])
    .filter((absolutePath) => !allowLiteral.has(absolutePath))
    .filter((absolutePath) => (readOrNull(absolutePath) ?? "").includes(appName));
  record(
    strays.length === 0,
    "branding: display name lives only in app-config.ts (frontend imports it)",
    `expected no frontend file outside app-config.ts to hardcode "${appName}" — import { APP_NAME } instead. Offending: ${JSON.stringify(strays.map(rel))}`,
  );

  // --- 3. one B2 attribution token everywhere -----------------------------
  // Canonical = the custom user agent on the B2 client. Every other
  // user_agent_extra and every utm_content must match it, so the sample keeps
  // one attribution identity across its SDK telemetry and marketing links.
  const b2Client = readOrNull(
    join(repoRoot, "services/api/app/repo/b2_client.py"),
  );
  const canonMatch = b2Client
    ? /user_agent_extra\s*=\s*"([^"]+)"/.exec(b2Client)
    : null;
  if (!canonMatch) {
    skips.push(
      "branding: B2 attribution check (no user_agent_extra in services/api/app/repo/b2_client.py)",
    );
  } else {
    const token = canonMatch[1];
    record(
      token.trim() !== "",
      "branding: B2 custom user agent (user_agent_extra) is set",
      "expected a non-empty user_agent_extra on the B2 S3 client",
    );

    // Scan by surface: `user_agent_extra` is a boto3 kwarg (Python only);
    // `utm_content` lives in URLs (Markdown/JS/TS). Splitting the scans by
    // extension — and skipping this checker's own source — keeps the checker
    // from matching the very regexes it uses to find the token.
    const checkerDir = join(repoRoot, "scripts", "agent-docs");
    const notChecker = (file) => !file.startsWith(checkerDir);

    const pyFiles = [
      ...walk(join(repoRoot, "services/api/app"), [".py"]),
      ...walk(join(repoRoot, "services/api/scripts"), [".py"]),
    ];
    const urlFiles = [join(repoRoot, "README.md")];
    for (const root of [
      join(repoRoot, "apps/web/src"),
      join(repoRoot, "scripts"),
      join(repoRoot, "docs"),
    ]) {
      urlFiles.push(...walk(root, [".md", ".mjs", ".js", ".ts", ".tsx"]).filter(notChecker));
    }

    const mismatches = [];
    for (const absolutePath of pyFiles) {
      const text = readOrNull(absolutePath);
      if (text === null) {
        continue;
      }
      for (const match of text.matchAll(/user_agent_extra\s*=\s*"([^"]+)"/g)) {
        if (match[1] !== token) {
          mismatches.push(`${rel(absolutePath)}: user_agent_extra="${match[1]}"`);
        }
      }
    }
    for (const absolutePath of urlFiles) {
      const text = readOrNull(absolutePath);
      if (text === null) {
        continue;
      }
      for (const match of text.matchAll(/utm_content=([A-Za-z0-9._-]+)/g)) {
        if (match[1] !== token) {
          mismatches.push(`${rel(absolutePath)}: utm_content=${match[1]}`);
        }
      }
    }
    record(
      mismatches.length === 0,
      `branding: one B2 attribution token ("${token}") across user_agent_extra and utm_content`,
      `expected every user_agent_extra and utm_content to equal "${token}". Drifted: ${JSON.stringify(mismatches)}`,
    );
  }

  return { passes, failures, skips };
}
