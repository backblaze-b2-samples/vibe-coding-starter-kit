#!/usr/bin/env node
// Deterministic frontend structure invariants.
// Run via: pnpm check:structure:web (runs scripts/check-frontend-structure.test.mjs first)
//
// Rule 1 — network access lives in one module.
//   The global fetch, XMLHttpRequest, navigator.sendBeacon and HTTP client
//   libraries (axios) may only be used in apps/web/src/lib/api-client.ts.
//   Everything else calls the named functions that module exports.
//
// Rule 2 — no direct query-library access outside lib/.
//   Components and pages consume named hooks from lib/queries.ts. Only files
//   under apps/web/src/lib/ may load @tanstack/react-query or
//   @tanstack/query-core, by any route: static import, side-effect import,
//   re-export, dynamic import(), require() or `import x = require()`.
//
// The source is parsed (TypeScript's parser, a dependency of apps/web), so
// comments and string contents never match, and spacing or line breaks such
// as `fetch (url)` cannot hide a call. .ts/.tsx/.js/.jsx/.mjs/.cjs are all
// scanned; test files are not (they stub the network deliberately).

import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API_CLIENT = "apps/web/src/lib/api-client.ts";
const LIB_PREFIX = "apps/web/src/lib/";
const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const TEST_FILE = /\.(?:test|spec)\.[^/]+$/;
const GLOBAL_OBJECTS = new Set(["window", "globalThis", "self", "global"]);
const NETWORK_MODULES = new Set(["axios"]);
const QUERY_MODULES = new Set(["@tanstack/react-query", "@tanstack/query-core"]);

function loadTypeScript(root) {
  // Resolve from apps/web so the checker works wherever pnpm placed the package.
  for (const base of [join(root, "apps", "web", "package.json"), join(SCRIPT_ROOT, "apps", "web", "package.json")]) {
    try {
      return createRequire(base)("typescript");
    } catch {
      // try the next location
    }
  }
  throw new Error("check:structure:web needs the `typescript` package; run `pnpm install` first.");
}

let tsModule;
function getTs(root = SCRIPT_ROOT) {
  tsModule ??= loadTypeScript(root);
  return tsModule;
}

function moduleName(specifier) {
  return QUERY_MODULES.has(specifier) || [...QUERY_MODULES].some((m) => specifier.startsWith(`${m}/`))
    ? "query"
    : NETWORK_MODULES.has(specifier) || specifier.startsWith("axios/")
      ? "network"
      : null;
}

function scriptKind(ts, relPath) {
  if (relPath.endsWith("x") && !relPath.endsWith(".mjs") && !relPath.endsWith(".cjs")) {
    return relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.JSX;
  }
  return /\.[cm]?ts$/.test(relPath) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

/**
 * Violations in one source file.
 * @param {string} relPath repo-relative, forward-slash path (decides which rules apply)
 * @param {string} source file contents
 * @returns {{line: number, message: string}[]}
 */
export function scanSource(relPath, source) {
  if (TEST_FILE.test(relPath)) return [];

  const ts = getTs();
  const allowNetwork = relPath === API_CLIENT;
  const allowQuery = relPath.startsWith(LIB_PREFIX);
  const file = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, scriptKind(ts, relPath));
  const violations = [];

  const report = (node, message) => {
    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
    violations.push({ line: line + 1, message });
  };
  const network = (node, what) => {
    if (!allowNetwork) {
      report(node, `${what}; network access belongs in lib/api-client.ts. Call one of its exported functions (through a hook in lib/queries.ts).`);
    }
  };
  const query = (node, what) => {
    if (!allowQuery) {
      report(node, `${what}; use the named hooks from lib/queries.ts.`);
    }
  };
  const checkModule = (node, specifier, how) => {
    const kind = moduleName(specifier);
    if (kind === "query") query(node, `${how} of ${specifier}`);
    if (kind === "network") network(node, `${how} of ${specifier}`);
  };
  const stringArg = (call) => {
    const [arg] = call.arguments;
    return arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) ? arg.text : null;
  };

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      checkModule(node, node.moduleSpecifier.text, ts.isImportDeclaration(node) ? "import" : "re-export");
    } else if (ts.isExternalModuleReference(node) && ts.isStringLiteral(node.expression)) {
      checkModule(node, node.expression.text, "require");
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isRequire = ts.isIdentifier(callee) && callee.text === "require";
      const isDynamicImport = callee.kind === ts.SyntaxKind.ImportKeyword;
      if (isRequire || isDynamicImport) {
        const specifier = stringArg(node);
        if (specifier) checkModule(node, specifier, isRequire ? "require" : "dynamic import");
      }
    } else if (ts.isIdentifier(node) && node.text === "XMLHttpRequest") {
      network(node, "XMLHttpRequest");
    } else if (ts.isIdentifier(node) && node.text === "fetch" && isGlobalFetchReference(ts, node)) {
      network(node, "global fetch");
    } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const member = ts.isPropertyAccessExpression(node)
        ? node.name.text
        : ts.isStringLiteralLike(node.argumentExpression)
          ? node.argumentExpression.text
          : null;
      const target = node.expression;
      if (ts.isIdentifier(target) && GLOBAL_OBJECTS.has(target.text) && (member === "fetch" || member === "XMLHttpRequest")) {
        network(node, `${target.text}.${member}`);
      } else if (member === "sendBeacon" && ts.isIdentifier(target) && target.text === "navigator") {
        network(node, "navigator.sendBeacon");
      } else if (member === "sendBeacon" && ts.isPropertyAccessExpression(target) && target.name.text === "navigator") {
        network(node, "navigator.sendBeacon");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return violations;
}

/** An identifier `fetch` that refers to the global, not a member or a declaration. */
function isGlobalFetchReference(ts, node) {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertySignature(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node) return false;
  if (ts.isShorthandPropertyAssignment(parent)) return true;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return false;
  return true;
}

function* walkSources(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") yield* walkSources(full);
    } else if (SOURCE_EXTENSIONS.test(entry.name)) {
      yield full;
    }
  }
}

/** Scan apps/web/src under `root`; returns formatted violation lines. */
export function scanTree(root) {
  const webSrc = join(root, "apps", "web", "src");
  const lines = [];
  for (const absPath of walkSources(webSrc)) {
    const relPath = relative(root, absPath).replace(/\\/g, "/");
    for (const { line, message } of scanSource(relPath, readFileSync(absPath, "utf8"))) {
      lines.push(`  ${relPath}:${line}\n    -> ${message}`);
    }
  }
  return lines;
}

function main(argv) {
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag >= 0 ? resolve(argv[rootFlag + 1]) : SCRIPT_ROOT;
  getTs(root);
  const violations = scanTree(root);
  if (violations.length > 0) {
    console.error(`\ncheck:structure:web - frontend structure violations:\n\n${violations.join("\n")}\n`);
    process.exit(1);
  }
  console.log("check:structure:web - all frontend structure invariants pass");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
