import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { API_CLIENT_ROUTES } from "./api-client";

/**
 * Every OpenAPI operation verb, not just the ones the client happens to use:
 * omitting a verb here silently exempts operations declared with it from the
 * "no unmapped operation" assertion below. The client's own narrower verb union
 * lives in `api-client.ts` on purpose — it is the set of verbs the hand-written
 * client supports, which is a different set from what the spec may declare.
 */
type RouteMethod =
  | "delete"
  | "get"
  | "head"
  | "options"
  | "patch"
  | "post"
  | "put"
  | "trace";

type OpenApiContract = {
  paths: Record<string, Partial<Record<RouteMethod, unknown>>>;
};

const CONTRACT_PATH = fileURLToPath(
  new URL("../../../../docs/api/openapi.json", import.meta.url)
);

if (!existsSync(CONTRACT_PATH)) {
  throw new Error(
    `${CONTRACT_PATH} is missing. Run \`pnpm contract:export\` and commit the result.`
  );
}

const CONTRACT = JSON.parse(
  readFileSync(CONTRACT_PATH, "utf8")
) as OpenApiContract;
const OPENAPI_METHODS = new Set<RouteMethod>([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);

// Prometheus metrics are intentionally scraped server-side, not called by the
// app shell. Add future backend-only operations here deliberately.
const SERVER_ONLY_OPERATIONS = new Set(["get /metrics"]);

function operationKey(method: string, path: string) {
  return `${method} ${path}`;
}

describe("API client contract", () => {
  it.each(Object.entries(API_CLIENT_ROUTES))(
    "%s is present in the checked-in OpenAPI contract",
    (_name, route) => {
      expect(
        CONTRACT.paths[route.path]?.[route.method],
        `${route.method.toUpperCase()} ${route.path} is missing from ${CONTRACT_PATH}`
      ).toBeDefined();
    }
  );

  it("maps every frontend-facing OpenAPI operation to the client route registry", () => {
    const clientOperations = new Set(
      Object.values(API_CLIENT_ROUTES).map((route) =>
        operationKey(route.method, route.path)
      )
    );
    const unmappedOperations = Object.entries(CONTRACT.paths).flatMap(
      ([path, operations]) =>
        Object.keys(operations)
          .filter((method): method is RouteMethod =>
            OPENAPI_METHODS.has(method as RouteMethod)
          )
          .map((method) => operationKey(method, path))
          .filter(
            (key) =>
              !clientOperations.has(key) && !SERVER_ONLY_OPERATIONS.has(key)
          )
    );

    expect(unmappedOperations).toEqual([]);
  });
});
