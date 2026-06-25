#!/usr/bin/env node
// Deterministic frontend structure invariants.
// Run via: pnpm check:structure:web
//
// Rule 1 — no bare fetch() outside the API client layer
//   fetch() must only appear in apps/web/src/lib/api-client.ts.
//   All other code uses the typed apiFetch() wrapper from that module.
//
// Rule 2 — no direct @tanstack/react-query imports outside lib/
//   Components and pages must consume named hooks from lib/queries.ts.
//   Only files under apps/web/src/lib/ may import from @tanstack/react-query.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_SRC = join(ROOT, "apps", "web", "src");

function* walkTS(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTS(full);
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      yield full;
    }
  }
}

const violations = [];

for (const absPath of walkTS(WEB_SRC)) {
  const relPath = relative(ROOT, absPath).replace(/\\/g, "/");
  const src = readFileSync(absPath, "utf8");

  // Rule 1: bare fetch() only in lib/api-client.ts
  const isApiClient = relPath === "apps/web/src/lib/api-client.ts";
  if (!isApiClient && /\bfetch\(/.test(src)) {
    violations.push(
      `  ${relPath}\n    → bare fetch() call; use apiFetch() via lib/api-client.ts`,
    );
  }

  // Rule 2: @tanstack/react-query imports only in lib/
  const inLib = relPath.startsWith("apps/web/src/lib/");
  if (!inLib && /from ["']@tanstack\/react-query["']/.test(src)) {
    violations.push(
      `  ${relPath}\n    → direct @tanstack/react-query import; use named hooks from lib/queries.ts`,
    );
  }
}

if (violations.length > 0) {
  console.error(`\n✗ check:structure:web — frontend structure violations:\n\n${violations.join("\n")}\n`);
  process.exit(1);
}

console.log("✓ check:structure:web — all frontend structure invariants pass");
