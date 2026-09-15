#!/usr/bin/env node
/**
 * Generate the mechanical doc scaffolding from one declared manifest.
 *
 * Input: `docs/exec-plans/sample.json` (schema: `scripts/gen/sample.schema.json`),
 * or `--config <path>`, or the `--name`-style flags below for a human who has
 * no manifest yet.
 *
 * Output: marker-delimited regions inside ARCHITECTURE.md, AGENTS.md,
 * README.md and the `infra/` runbooks, plus the section skeleton of
 * `docs/app-workflows.md`. Everything OUTSIDE a marker pair is hand-written
 * and never touched — the generators own the busywork, not the prose.
 *
 * Zero dependencies (node: builtins only), offline, and idempotent: running it
 * twice on the same manifest produces byte-identical files.
 *
 * Deliberate design choices worth knowing:
 *
 *  - A missing or unbalanced marker is a HARD ERROR in both modes, never a
 *    silent append. Marker rot is the main risk in a repo whose docs get
 *    rewritten wholesale, and a generator that quietly re-appends a region
 *    would hide the rewrite that lost it.
 *  - `AGENTS.md` is size-checked BEFORE it is written, against the same limits
 *    `pnpm check:agent-docs` enforces. Otherwise this script would green-light
 *    a file the next gate rejects, one step too late.
 *  - `docs/app-workflows.md` carries no markers. Its body is behavioural prose
 *    that only a human or a model can write, so only the section skeleton is
 *    managed: the `## <heading>` for each feature that has a screen, and that
 *    section's trailing `- See: […]` link. Wrapping eight marker lines around
 *    four one-line footers would make a 53-line document worse.
 *
 * Usage:
 *   node scripts/gen-docs.mjs                 write the regions
 *   node scripts/gen-docs.mjs --check         fail if anything is stale
 *   node scripts/gen-docs.mjs --config path   read a manifest from elsewhere
 *   node scripts/gen-docs.mjs --emit-config p write a manifest from flags
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AGENT_DOC_LIMITS } from "./agent-docs/limits.mjs";
import { architecture } from "./gen/doc-regions/architecture.mjs";
import { agentsDoc } from "./gen/doc-regions/agents.mjs";
import { infraRunbooks } from "./gen/doc-regions/infra.mjs";
import { readmeDoc } from "./gen/doc-regions/readme.mjs";
import { syncWorkflows } from "./gen/doc-regions/app-workflows.mjs";
import { COMMANDS } from "./gen/doc-regions/commands.mjs";
import { buildContext } from "./gen/doc-regions/context.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST = "docs/exec-plans/sample.json";
const SCHEMA_PATH = "scripts/gen/sample.schema.json";
const SUPPORTED_SCHEMA_VERSION = 1;

/** The single declaration of the budget, shared with check-agent-docs.mjs so
 *  this generator refuses to emit a file that gate would then reject. */
const AGENTS_LIMITS = AGENT_DOC_LIMITS;

const BEGIN = /^<!--\s*gen:begin\s+([a-z0-9-]+)\s*-->$/;
const END = /^<!--\s*gen:end\s+([a-z0-9-]+)\s*-->$/;

const MODULES = [architecture, agentsDoc, readmeDoc, infraRunbooks].flat();

function fail(message) {
  process.stderr.write(`gen:docs failed: ${message}\n`);
  process.exit(1);
}

function repoPath(relativePath) {
  return join(REPO_ROOT, relativePath);
}

// --- manifest: file, flags, validation -----------------------------------

/**
 * Field flags, so a human with no manifest can still drive the generator.
 * `repeat` fields take `a|b|c` and are passed once per item.
 */
const FLAGS = {
  "--name": { path: ["name"] },
  "--slug": { path: ["slug"] },
  "--package-scope": { path: ["package_scope"] },
  "--purpose": { path: ["purpose"] },
  "--tagline": { path: ["tagline"] },
  "--primary-entity": { path: ["primary_entity"], fields: ["schema", "singular", "plural"] },
  "--key-prefix": { path: ["b2_key_prefix"] },
  "--attribution-token": { path: ["attribution_token"] },
  "--repo": { path: ["repo"], fields: ["org", "name"], separator: "/" },
  "--stack-web": { path: ["stack", "web"] },
  "--stack-api": { path: ["stack", "api"] },
  "--stack-storage": { path: ["stack", "storage"] },
  "--stack-package-manager": { path: ["stack", "package_manager"] },
  "--deploy": { path: ["deployment_targets"], repeat: true },
  "--feature": {
    path: ["features"],
    repeat: true,
    fields: ["title", "route", "doc", "summary", "workflow_heading"],
  },
  "--b2-op": { path: ["b2_surface"], repeat: true, fields: ["operation", "why"] },
  "--env": {
    path: ["env_vars"],
    repeat: true,
    fields: ["name", "required", "secret", "note"],
    booleans: { required: "required", secret: "secret" },
  },
  "--screenshot": { path: ["screenshots"], repeat: true, fields: ["path", "alt", "caption"] },
};

function assign(target, path, value) {
  let cursor = target;

  for (const key of path.slice(0, -1)) {
    cursor[key] ??= {};
    cursor = cursor[key];
  }

  cursor[path.at(-1)] = value;
}

function push(target, path, value) {
  let cursor = target;

  for (const key of path.slice(0, -1)) {
    cursor[key] ??= {};
    cursor = cursor[key];
  }

  cursor[path.at(-1)] ??= [];
  cursor[path.at(-1)].push(value);
}

function structured(spec, raw) {
  const parts = raw.split(spec.separator ?? "|");
  const value = {};

  spec.fields.forEach((field, index) => {
    const part = parts[index];

    if (part === undefined || part === "") {
      return;
    }

    if (spec.booleans?.[field]) {
      value[field] = part === spec.booleans[field] || part === "true";
      return;
    }

    value[field] = part === "null" ? null : part;
  });

  return value;
}

function manifestFromFlags(argv) {
  const manifest = { schema_version: SUPPORTED_SCHEMA_VERSION };
  let used = false;

  for (let index = 0; index < argv.length; index += 1) {
    const spec = FLAGS[argv[index]];

    if (!spec) {
      continue;
    }

    const raw = argv[index + 1];

    if (raw === undefined || raw.startsWith("--")) {
      fail(`${argv[index]} needs a value.`);
    }

    used = true;
    index += 1;
    const value = spec.fields ? structured(spec, raw) : raw;

    if (spec.repeat) {
      push(manifest, spec.path, value);
    } else {
      assign(manifest, spec.path, value);
    }
  }

  if (argv.includes("--no-screenshots")) {
    used = true;
    manifest.screenshots ??= [];
  }

  return used ? manifest : null;
}

/**
 * Minimal structural validation driven by the JSON Schema itself, so the
 * schema file and the generator cannot disagree about what is required. Not a
 * full validator: it checks presence, top-level types, enums, and the required
 * keys of array items — which is what stops the generator emitting garbage.
 */
function validate(manifest, schema) {
  const problems = [];

  const typeOf = (value) =>
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

  const checkTypes = (value, spec, where) => {
    if (spec.const !== undefined && value !== spec.const) {
      problems.push(`${where}: expected ${JSON.stringify(spec.const)}, got ${JSON.stringify(value)}`);
      return;
    }

    if (spec.enum && !spec.enum.includes(value)) {
      problems.push(`${where}: expected one of ${JSON.stringify(spec.enum)}, got ${JSON.stringify(value)}`);
      return;
    }

    const allowed = spec.type === undefined ? null : [spec.type].flat();

    if (allowed && !allowed.includes(typeOf(value))) {
      problems.push(`${where}: expected ${allowed.join(" or ")}, got ${typeOf(value)}`);
      return;
    }

    if (typeOf(value) === "object" && spec.properties) {
      for (const key of spec.required ?? []) {
        if (value[key] === undefined) {
          problems.push(`${where}: missing required key "${key}"`);
        }
      }

      for (const [key, child] of Object.entries(value)) {
        if (spec.properties[key]) {
          checkTypes(child, spec.properties[key], `${where}.${key}`);
        }
      }
    }

    if (typeOf(value) === "array" && spec.items) {
      value.forEach((item, index) => checkTypes(item, spec.items, `${where}[${index}]`));
    }
  };

  for (const key of schema.required) {
    if (manifest[key] === undefined) {
      problems.push(
        `missing required field "${key}" — add it to the manifest, or pass the matching flag (see \`node scripts/gen-docs.mjs --help\`)`,
      );
    }
  }

  for (const [key, value] of Object.entries(manifest)) {
    if (schema.properties[key]) {
      checkTypes(value, schema.properties[key], key);
    }
  }

  if (problems.length > 0) {
    fail(`the sample manifest is not usable:\n  - ${problems.join("\n  - ")}`);
  }
}

// --- cross-file identity invariants --------------------------------------

/**
 * The manifest declares identity that other files also declare, and the two
 * must not drift. These are asserted rather than written: generating
 * app-config.ts would put the display name in a second place, which is
 * exactly what the branding check exists to prevent.
 */
function checkIdentity(manifest) {
  const problems = [];
  const appConfig = readFileSync(repoPath("apps/web/src/lib/app-config.ts"), "utf8");
  const appName = /export\s+const\s+APP_NAME\s*=\s*"([^"]+)"/.exec(appConfig)?.[1];
  const derivedSlug = appName
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (appName !== manifest.name) {
    problems.push(
      `manifest \`name\` is ${JSON.stringify(manifest.name)} but APP_NAME in ` +
        `apps/web/src/lib/app-config.ts is ${JSON.stringify(appName ?? null)}`,
    );
  }

  if (derivedSlug !== manifest.slug) {
    problems.push(
      `manifest \`slug\` is ${JSON.stringify(manifest.slug)} but the slug derived ` +
        `from APP_NAME is ${JSON.stringify(derivedSlug ?? null)}`,
    );
  }

  const b2Client = repoPath("services/api/app/repo/b2_client.py");

  if (existsSync(b2Client)) {
    const token = /user_agent_extra\s*=\s*"([^"]+)"/.exec(
      readFileSync(b2Client, "utf8"),
    )?.[1];

    if (token !== manifest.attribution_token) {
      problems.push(
        `manifest \`attribution_token\` is ${JSON.stringify(manifest.attribution_token)} ` +
          `but the S3 client's user_agent_extra is ${JSON.stringify(token ?? null)}`,
      );
    }
  }

  for (const feature of manifest.features) {
    if (!existsSync(repoPath(feature.doc))) {
      problems.push(`feature "${feature.title}" points at ${feature.doc}, which does not exist`);
    }
  }

  for (const shot of manifest.screenshots) {
    if (!existsSync(repoPath(shot.path))) {
      problems.push(
        `screenshot ${shot.path} does not exist. Take it, or drop the entry: an ` +
          `empty \`screenshots\` array is valid and emits no image embeds at all.`,
      );
    }
  }

  for (const target of manifest.deployment_targets) {
    if (!existsSync(repoPath(`infra/${target}/README.md`))) {
      problems.push(`deployment target "${target}" has no runbook at infra/${target}/README.md`);
    }
  }

  const scripts = JSON.parse(readFileSync(repoPath("package.json"), "utf8")).scripts ?? {};
  const missing = COMMANDS.map((command) => command.script).filter(
    (script) => scripts[script] === undefined,
  );

  if (missing.length > 0) {
    problems.push(
      `the command tables name package.json scripts that no longer exist: ${JSON.stringify(missing)}`,
    );
  }

  if (problems.length > 0) {
    fail(`the manifest disagrees with the repository:\n  - ${problems.join("\n  - ")}`);
  }
}

// --- marker engine --------------------------------------------------------

/**
 * @returns {{text: string, changed: boolean}}
 * @throws never — a structural problem exits the process with a named error.
 */
function applyRegions(relativePath, regions, context) {
  const absolute = repoPath(relativePath);

  if (!existsSync(absolute)) {
    fail(`${relativePath} is missing, so its generated regions have nowhere to go.`);
  }

  const original = readFileSync(absolute, "utf8");
  const lines = original.split("\n");
  const found = new Map();
  const output = [];
  let open = null;

  for (const line of lines) {
    const begin = BEGIN.exec(line.trim());
    const end = END.exec(line.trim());

    if (begin) {
      if (open) {
        fail(
          `${relativePath}: region "${begin[1]}" opens inside "${open}". Generated ` +
            `regions cannot nest — restore the markers (\`git checkout -- ${relativePath}\`) and re-run.`,
        );
      }

      if (found.has(begin[1])) {
        fail(`${relativePath}: region "${begin[1]}" is declared twice.`);
      }

      if (!regions[begin[1]]) {
        fail(
          `${relativePath}: unknown generated region "${begin[1]}". Either the ` +
            `marker is a typo, or the generator that owned it was removed.`,
        );
      }

      open = begin[1];
      found.set(open, true);
      output.push(line, regions[open](context));
      continue;
    }

    if (end) {
      if (open !== end[1]) {
        fail(
          `${relativePath}: \`gen:end ${end[1]}\` does not close ` +
            `${open ? `\`gen:begin ${open}\`` : "any open region"}. ` +
            `Restore the markers (\`git checkout -- ${relativePath}\`) and re-run.`,
        );
      }

      open = null;
      output.push(line);
      continue;
    }

    if (open === null) {
      output.push(line);
    }
  }

  if (open) {
    fail(
      `${relativePath}: region "${open}" is never closed. Restore the markers ` +
        `(\`git checkout -- ${relativePath}\`) and re-run.`,
    );
  }

  const missing = Object.keys(regions).filter((id) => !found.has(id));

  if (missing.length > 0) {
    fail(
      `${relativePath} has lost ${missing.length} generated region(s): ${missing.join(", ")}. ` +
        `A whole-file rewrite is the usual cause. This is never repaired silently — put the ` +
        `\`<!-- gen:begin … -->\` / \`<!-- gen:end … -->\` pair back where it belongs ` +
        `(\`git checkout -- ${relativePath}\` restores it) and re-run \`pnpm gen:docs\`.`,
    );
  }

  return { text: output.join("\n"), changed: output.join("\n") !== original };
}

function guardSize(relativePath, text) {
  if (relativePath !== AGENTS_LIMITS.path) {
    return;
  }

  const lines = text.trimEnd().split("\n").length;
  const bytes = Buffer.byteLength(text, "utf8");

  if (lines > AGENTS_LIMITS.maxLines || bytes > AGENTS_LIMITS.maxBytes) {
    fail(
      `refusing to write ${relativePath}: it would be ${lines} lines / ${bytes} bytes, ` +
        `over the ${AGENTS_LIMITS.maxLines}-line / ${AGENTS_LIMITS.maxBytes}-byte budget ` +
        `\`pnpm check:agent-docs\` enforces. Shorten the hand-written prose, or raise the ` +
        `limit deliberately in scripts/check-agent-docs.mjs AND here — but do not drop a region.`,
    );
  }
}

// --- driver ---------------------------------------------------------------

function loadManifest(argv) {
  const configIndex = argv.indexOf("--config");
  const explicit = configIndex === -1 ? null : argv[configIndex + 1];
  const path = explicit ?? DEFAULT_MANIFEST;

  if (existsSync(repoPath(path))) {
    try {
      return JSON.parse(readFileSync(repoPath(path), "utf8"));
    } catch (error) {
      fail(`${path} is not valid JSON — ${error.message}`);
    }
  }

  if (explicit) {
    fail(`--config ${explicit} does not exist.`);
  }

  const fromFlags = manifestFromFlags(argv);

  if (fromFlags) {
    return fromFlags;
  }

  fail(
    `no sample manifest. Create ${DEFAULT_MANIFEST} (fields are documented in ` +
      `${SCHEMA_PATH}), point at one with --config <path>, or pass the fields as ` +
      `flags (--name, --slug, --purpose, --tagline, --primary-entity, --feature, ` +
      `--b2-op, --key-prefix, --deploy, --env, --attribution-token, --repo, ` +
      `--screenshot / --no-screenshots) and optionally --emit-config <path> to save them.`,
  );
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const manifest = loadManifest(argv);
  const schema = JSON.parse(readFileSync(repoPath(SCHEMA_PATH), "utf8"));

  if (manifest.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    fail(
      `manifest schema_version ${JSON.stringify(manifest.schema_version)} is not ` +
        `supported by this generator (expects ${SUPPORTED_SCHEMA_VERSION}).`,
    );
  }

  validate(manifest, schema);

  const emitIndex = argv.indexOf("--emit-config");

  if (emitIndex !== -1) {
    const target = argv[emitIndex + 1];

    if (!target) {
      fail("--emit-config needs a path.");
    }

    writeFileSync(repoPath(target), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    process.stdout.write(`gen:docs wrote the manifest to ${target}\n`);
  }

  checkIdentity(manifest);

  const context = buildContext(manifest, REPO_ROOT);

  // Render and validate EVERY file before writing any of them. A generator
  // that wrote as it went would leave the tree half-updated when a later file
  // failed its size guard — which is the kind of quiet mess this whole change
  // exists to remove.
  const plan = MODULES.map((module) => {
    const { text, changed } = applyRegions(module.file, module.regions, context);
    guardSize(module.file, text);
    return { file: module.file, text, changed };
  });

  plan.push(
    syncWorkflows(context, {
      read: (path) => readFileSync(repoPath(path), "utf8"),
      fail,
    }),
  );

  const stale = plan.filter((entry) => entry.changed).map((entry) => entry.file);
  const written = [];

  if (!check) {
    for (const entry of plan.filter((candidate) => candidate.changed)) {
      writeFileSync(repoPath(entry.file), entry.text, "utf8");
      written.push(entry.file);
    }
  }

  if (check) {
    if (stale.length > 0) {
      fail(
        `${stale.length} file(s) do not match the manifest: ${stale.join(", ")}. ` +
          `Run \`pnpm gen:docs\` and commit the result.`,
      );
    }

    process.stdout.write(
      `gen:docs check passed (${MODULES.length + 1} files current against ${DEFAULT_MANIFEST})\n`,
    );
    return;
  }

  process.stdout.write(
    written.length === 0
      ? "gen:docs: every generated region was already current\n"
      : `gen:docs updated ${written.length} file(s): ${written.join(", ")}\n`,
  );
}

main();
