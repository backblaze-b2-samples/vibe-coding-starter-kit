#!/usr/bin/env node
/**
 * Generate the mechanical half of the web <-> API wiring seam.
 *
 * Inputs (both checked in, both offline):
 *   docs/api/openapi.json        written by `pnpm contract:export` from the
 *                                FastAPI routers and Pydantic models — the
 *                                single source of truth for routes and shapes
 *   scripts/gen/api-gen.config.json  naming policy and deliberate exclusions
 *
 * Outputs:
 *   packages/shared/src/generated/api-types.ts   TypeScript for every schema
 *   apps/web/src/lib/generated/api-routes.ts     the route registry
 *   apps/web/src/lib/generated/query-keys.ts     the query-key factory
 *
 * Zero dependencies (node: builtins only), no venv, no running backend: it
 * reads a committed JSON artifact, so it works in a fresh clone before
 * `pnpm install`. Deterministic: operations are emitted in sorted order, so
 * two runs on the same inputs produce byte-identical files.
 *
 * What it deliberately does NOT generate is listed in the config's
 * `escapeHatch`: error policy, base-URL resolution, the legacy-route fallback,
 * the upload transport, and every caching decision stay hand-written.
 *
 * Usage:
 *   node scripts/gen-api.mjs            write the files
 *   node scripts/gen-api.mjs --check    fail if a file is stale (no writes)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = "docs/api/openapi.json";
const CONFIG = "scripts/gen/api-gen.config.json";

const TARGETS = {
  types: "packages/shared/src/generated/api-types.ts",
  routes: "apps/web/src/lib/generated/api-routes.ts",
  queryKeys: "apps/web/src/lib/generated/query-keys.ts",
};

/** Every verb OpenAPI can declare, so a new one is never silently ignored. */
const HTTP_METHODS = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);

const WRITE_HINT = "Run `pnpm gen:api` and commit the result.";

function fail(message) {
  process.stderr.write(`gen:api failed: ${message}\n`);
  process.exit(1);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(join(REPO_ROOT, relativePath), "utf8"));
  } catch (error) {
    fail(`cannot read ${relativePath} — ${error.message}`);
  }
}

// --- generated-file header ------------------------------------------------

function header(sources) {
  return [
    "// GENERATED FILE — DO NOT EDIT.",
    "//",
    "// Written by `pnpm gen:api` from:",
    ...sources.map((source) => `//   ${source}`),
    "//",
    "// Hand edits are discarded by the next `pnpm gen:api`. `pnpm gen:check`",
    "// (part of `pnpm verify:web`) fails while this file disagrees with the",
    "// contract. To change what is here, change the FastAPI route or Pydantic",
    `// model and re-run \`pnpm contract:export && pnpm gen:api\`.`,
    "",
  ].join("\n");
}

// --- shared helpers -------------------------------------------------------

function operationKey(method, path) {
  return `${method} ${path}`;
}

/** `/files-by-key/detail` + delete -> `filesByKeyDetailDelete`. */
function deriveRouteName(method, path) {
  const words = path
    .split("/")
    .filter((segment) => segment !== "" && !segment.startsWith("{"))
    .flatMap((segment) => segment.split(/[^A-Za-z0-9]+/))
    .filter(Boolean);
  const suffix = method === "get" ? [] : [method];
  return [...words, ...suffix]
    .map((word, index) =>
      index === 0
        ? word[0].toLowerCase() + word.slice(1)
        : word[0].toUpperCase() + word.slice(1),
    )
    .join("");
}

/** Wrap a doc string as a JSDoc block at `indent`, or "" when there is none. */
function jsDoc(text, indent) {
  if (!text || text.trim() === "") {
    return "";
  }

  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    if (line === "") {
      line = word;
    } else if (`${line} ${word}`.length <= 72 - indent.length) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line !== "") {
    lines.push(line);
  }

  if (lines.length === 1) {
    return `${indent}/** ${lines[0]} */\n`;
  }

  return [
    `${indent}/**`,
    ...lines.map((part) => `${indent} * ${part}`),
    `${indent} */`,
    "",
  ].join("\n");
}

// --- api-types.ts ---------------------------------------------------------

function refName(ref) {
  return ref.replace("#/components/schemas/", "");
}

/**
 * OpenAPI schema -> TypeScript type expression.
 *
 * One rule needs stating: a property that is absent from the schema's
 * `required` list is emitted optional (`name?:`). Response models inherit
 * `ResponseModel` on the Python side, whose
 * `json_schema_serialization_defaults_required` config puts every serialized
 * field into `required` — so a nullable response field arrives as
 * `field: T | null`, not `field?: T | null`, which is what the body actually
 * carries. Nothing here has to guess.
 */
function tsType(schema) {
  if (schema === undefined || Object.keys(schema).length === 0) {
    return "unknown";
  }

  if (schema.$ref) {
    return refName(schema.$ref);
  }

  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const members = schema.anyOf ?? schema.oneOf;
    const parts = [...new Set(members.map((member) => tsType(member)))];
    // `null` last: `string | null` reads better than `null | string`.
    parts.sort((a, b) => Number(a === "null") - Number(b === "null"));
    return parts.join(" | ");
  }

  if (schema.type === "array") {
    const item = tsType(schema.items);
    return item.includes(" ") ? `(${item})[]` : `${item}[]`;
  }

  if (schema.type === "string") {
    return "string";
  }

  if (schema.type === "integer" || schema.type === "number") {
    return "number";
  }

  if (schema.type === "boolean") {
    return "boolean";
  }

  if (schema.type === "null") {
    return "null";
  }

  if (schema.type === "object") {
    const extra = schema.additionalProperties;

    if (extra === undefined || extra === true) {
      return "Record<string, unknown>";
    }

    if (extra === false) {
      return "Record<string, never>";
    }

    return `Record<string, ${tsType(extra)}>`;
  }

  return "unknown";
}

function renderTypes(contract) {
  const schemas = contract.components?.schemas ?? {};
  const blocks = [];

  for (const name of Object.keys(schemas).sort()) {
    const schema = schemas[name];

    if (schema.type !== "object" || !schema.properties) {
      continue;
    }

    const required = new Set(schema.required ?? []);
    const lines = [];

    for (const property of Object.keys(schema.properties).sort()) {
      const propertySchema = schema.properties[property];
      const optional = required.has(property) ? "" : "?";
      lines.push(jsDoc(propertySchema.description, "  "));
      lines.push(`  ${property}${optional}: ${tsType(propertySchema)};\n`);
    }

    blocks.push(
      `${jsDoc(schema.description, "")}export interface ${name} {\n${lines.join("")}}\n`,
    );
  }

  if (blocks.length === 0) {
    fail(`${CONTRACT} declares no object schemas — nothing to generate.`);
  }

  return `${header([CONTRACT])}\n${blocks.join("\n")}`;
}

// --- api-routes.ts -------------------------------------------------------

function renderRoutes(operations, config) {
  const methods = [...new Set(operations.map((operation) => operation.method))]
    .sort()
    .map((method) => `"${method}"`)
    .join(" | ");

  const entries = operations.map(
    (operation) =>
      `  ${operation.routeName}: { method: "${operation.method}", path: "${operation.path}" },`,
  );

  return `${header([CONTRACT, CONFIG])}
/** The verbs this app's routes actually use, narrowed from the contract. */
export type ${config.routeTypeName} = {
  method: ${methods};
  path: string;
};

/**
 * Every frontend-callable operation in the contract, keyed by the name
 * \`${CONFIG}\` gives it. \`as const\` keeps each path and
 * verb a literal type, so a template-literal parameter can require a \`{…}\`
 * placeholder and a \`.method.toUpperCase()\` stays exact.
 */
export const ${config.clientName} = {
${entries.join("\n")}
} as const satisfies Record<string, ${config.routeTypeName}>;
`;
}

// --- query-keys.ts -------------------------------------------------------

function parameterType(schema) {
  if (schema?.type === "integer" || schema?.type === "number") {
    return "number";
  }

  if (schema?.type === "boolean") {
    return "boolean";
  }

  return "string";
}

function literal(value) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function renderQueryKeys(operations, config) {
  const { factoryName, rootName, root } = config.queryKeys;
  const members = [
    `  ${rootName}: [${root.map((part) => JSON.stringify(part)).join(", ")}] as const,`,
  ];

  for (const operation of operations) {
    if (!operation.query) {
      continue;
    }

    const parameters = (operation.spec.parameters ?? []).filter(
      (parameter) => parameter.in === "query",
    );
    const signature = parameters
      .map((parameter) => {
        const optional = parameter.required ? "" : "?";
        return `${parameter.name}${optional}: ${parameterType(parameter.schema)}`;
      })
      .join(", ");
    const parts = [
      `...${factoryName}.${rootName}`,
      ...operation.query.segments.map((segment) => JSON.stringify(segment)),
      ...parameters.map((parameter) =>
        parameter.required || parameter.schema?.default === undefined
          ? parameter.name
          : `${parameter.name} ?? ${literal(parameter.schema.default)}`,
      ),
    ];

    members.push(
      `  ${operation.query.name}: (${signature}) => [${parts.join(", ")}] as const,`,
    );
  }

  return `${header([CONTRACT, CONFIG])}
/**
 * Query keys for every cached read, derived from the contract's paths and
 * query parameters.
 *
 * The key *shape* is a caching decision, so it is declared per operation in
 * \`${CONFIG}\`: a child key nested under a parent's
 * segments (for example activity under stats) is invalidated by invalidating
 * the parent, and that hierarchy is the point. Defaults come from the
 * contract, so calling a member with no arguments produces the same key the
 * API would answer with no query string.
 */
export const ${factoryName} = {
${members.join("\n")}
};
`;
}

// --- driver ---------------------------------------------------------------

function collectOperations(contract, config) {
  const serverOnly = new Set(
    Object.keys(config.serverOnly?.operations ?? {}),
  );
  const declared = Object.entries(config.operations ?? {}).filter(
    ([key]) => !key.startsWith("$"),
  );
  const known = new Set();
  const operations = [];

  for (const [path, pathItem] of Object.entries(contract.paths ?? {})) {
    for (const [method, spec] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }

      const key = operationKey(method, path);
      known.add(key);

      if (serverOnly.has(key)) {
        continue;
      }

      const declaration = config.operations?.[key] ?? {};
      operations.push({
        key,
        method,
        path,
        spec,
        routeName: declaration.route ?? deriveRouteName(method, path),
        query: declaration.query ?? null,
      });
    }
  }

  // Named but absent: a typo, or a route deleted without updating the policy.
  // Silence here would quietly drop an endpoint from the registry.
  const unknown = [...serverOnly, ...declared.map(([key]) => key)].filter(
    (key) => !known.has(key),
  );

  if (unknown.length > 0) {
    fail(
      `${CONFIG} names ${unknown.length} operation(s) that ${CONTRACT} does not declare: ` +
        `${JSON.stringify(unknown)}. Re-run \`pnpm contract:export\`, or remove them from the config.`,
    );
  }

  const names = new Map();

  for (const operation of operations) {
    if (names.has(operation.routeName)) {
      fail(
        `two operations both want the route name "${operation.routeName}" ` +
          `(${names.get(operation.routeName)} and ${operation.key}). ` +
          `Give one of them a distinct \`route\` in ${CONFIG}.`,
      );
    }

    names.set(operation.routeName, operation.key);
  }

  operations.sort((a, b) => a.key.localeCompare(b.key));
  return operations;
}

function main() {
  const check = process.argv.includes("--check");
  const contract = readJson(CONTRACT);
  const config = readJson(CONFIG);
  const operations = collectOperations(contract, config);

  const rendered = {
    [TARGETS.types]: renderTypes(contract),
    [TARGETS.routes]: renderRoutes(operations, config),
    [TARGETS.queryKeys]: renderQueryKeys(operations, config),
  };

  const stale = [];
  const written = [];

  for (const [relativePath, content] of Object.entries(rendered)) {
    const absolute = join(REPO_ROOT, relativePath);
    let existing = null;

    try {
      existing = readFileSync(absolute, "utf8");
    } catch {
      existing = null;
    }

    if (existing === content) {
      continue;
    }

    if (check) {
      stale.push(existing === null ? `${relativePath} (missing)` : relativePath);
      continue;
    }

    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, "utf8");
    written.push(relativePath);
  }

  if (check) {
    if (stale.length > 0) {
      fail(
        `${stale.length} generated file(s) do not match the contract: ` +
          `${stale.join(", ")}. ${WRITE_HINT}`,
      );
    }

    process.stdout.write(
      `gen:api check passed (${operations.length} operations, ${Object.keys(rendered).length} files current)\n`,
    );
    return;
  }

  process.stdout.write(
    written.length === 0
      ? `gen:api: all 3 generated files were already current (${operations.length} operations)\n`
      : `gen:api updated ${written.length} file(s) from ${operations.length} operations: ${written.join(", ")}\n`,
  );
}

main();
