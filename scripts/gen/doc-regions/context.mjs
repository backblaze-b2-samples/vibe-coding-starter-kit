/**
 * Derived view of the sample manifest, shared by every region renderer.
 *
 * Nothing here is a second source of truth: every value is either read
 * straight from the manifest or computed from it plus the exported API
 * contract. Renderers stay declarative because the slicing happens once.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTRACT = "docs/api/openapi.json";

/** Every verb OpenAPI can declare. */
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

/** The one attribution query string, built from the manifest's token. */
function marketingLink(url, token) {
  const params = [
    "utm_source=github",
    "utm_medium=referral",
    "utm_campaign=ai_artifacts",
    `utm_content=${token}`,
  ].join("&");
  return `${url}${url.includes("?") ? "&" : "?"}${params}`;
}

function responseType(operation) {
  const schema =
    operation.responses?.["200"]?.content?.["application/json"]?.schema ?? {};

  if (schema.$ref) {
    return schema.$ref.replace("#/components/schemas/", "");
  }

  if (schema.type === "array" && schema.items?.$ref) {
    return `${schema.items.$ref.replace("#/components/schemas/", "")}[]`;
  }

  return null;
}

export function buildContext(manifest, repoRoot) {
  const contract = JSON.parse(readFileSync(join(repoRoot, CONTRACT), "utf8"));
  const routes = [];

  for (const [path, item] of Object.entries(contract.paths ?? {})) {
    for (const [method, operation] of Object.entries(item)) {
      if (HTTP_METHODS.has(method)) {
        routes.push({
          key: `${method} ${path}`,
          method: method.toUpperCase(),
          path,
          returns: responseType(operation),
        });
      }
    }
  }

  routes.sort((a, b) => a.key.localeCompare(b.key));

  const genConfig = JSON.parse(
    readFileSync(join(repoRoot, "scripts/gen/api-gen.config.json"), "utf8"),
  );
  const serverOnly = new Set(Object.keys(genConfig.serverOnly?.operations ?? {}));
  const routeNames = new Map(
    Object.entries(genConfig.operations ?? {})
      .filter(([key]) => !key.startsWith("$"))
      .map(([key, value]) => [key, value.route]),
  );

  return {
    ...manifest,
    contract,
    routes: routes.map((route) => ({
      ...route,
      serverOnly: serverOnly.has(route.key),
      clientRoute: routeNames.get(route.key) ?? null,
    })),
    deploys: (target) => manifest.deployment_targets.includes(target),
    screens: manifest.features.filter((feature) => feature.route !== null),
    offScreen: manifest.features.filter((feature) => feature.route === null),
    requiredVars: manifest.env_vars.filter((variable) => variable.required),
    secretVars: manifest.env_vars.filter((variable) => variable.secret),
    publicVars: manifest.env_vars.filter((variable) => !variable.secret),
    link: (url) => marketingLink(url, manifest.attribution_token),
  };
}

/** `["a", "b", "c"]` -> `"a, b and c"`. */
export function sentenceList(items) {
  if (items.length <= 1) {
    return items.join("");
  }

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** A Markdown table from a header row and body rows. */
export function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}
