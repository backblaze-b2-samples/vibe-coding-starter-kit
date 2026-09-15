/**
 * Generated regions of ARCHITECTURE.md.
 *
 * The hand-written half of that document — the layering rules, the boundary
 * invariants, the deployment prose, the trust boundaries, the data flows and
 * the observability notes — is argued reasoning that only a human or a model
 * can write, and none of it is touched here.
 */
import { table } from "./context.mjs";

function components(ctx) {
  const screens = ctx.screens.map(
    (feature) => `  - ${feature.title} (\`${feature.route}\`) — ${feature.summary}`,
  );
  const offScreen = ctx.offScreen.map(
    (feature) => `  - ${feature.title} — ${feature.summary}`,
  );

  return [
    ctx.purpose,
    "",
    `- **apps/web/** — ${ctx.stack.web}`,
    ...screens,
    `- **services/api/** — ${ctx.stack.api}`,
    "  - REST API for every operation the frontend consumes, exported to `docs/api/openapi.json`",
    `  - ${ctx.stack.storage} access isolated in the \`repo/\` layer`,
    ...offScreen,
    "  - Structured JSON logging with request tracing, plus `/health` and Prometheus `/metrics`",
    `- **packages/shared/** — TypeScript types generated from the API contract by \`pnpm gen:api\`, consumed by \`apps/web/\` as a workspace dependency (${ctx.stack.package_manager})`,
  ].join("\n");
}

/**
 * The backend tree. Fixed rather than manifest-driven on purpose: the five
 * layers are an invariant this repo enforces with a structural test, so the
 * fence is canonical for every app built on the kit — and a clone that
 * reorganises it should hear about it from `pnpm gen:check` rather than
 * discover the doc silently drifted.
 */
function directory() {
  return [
    "```",
    "services/api/",
    "  main.py                  App entrypoint, middleware, router registration",
    "  app/",
    "    types/                 Pydantic models, and the response-model base",
    "    config/                Settings loaded from environment",
    "    repo/                  B2 S3 client (data access layer)",
    "    service/               Business logic",
    "    runtime/               FastAPI route handlers",
    "  scripts/                 Operational scripts (OpenAPI export, bucket CORS)",
    "  tests/                   pytest tests (structural + integration)",
    "```",
  ].join("\n");
}

function dataStores(ctx) {
  return [
    `- **${ctx.stack.storage}** — the only data store; there is no application database`,
    `  - Every object this app writes lives under the \`${ctx.b2_key_prefix}\` key prefix of one bucket`,
    "  - Listing, per-key metadata and presigned URLs all come from the S3 surface below",
    `  - The primary entity is \`${ctx.primary_entity.schema}\`; one ${ctx.primary_entity.singular} is one object`,
  ].join("\n");
}

function externalServices(ctx) {
  return [
    `- **${ctx.stack.storage}** — reached only through \`services/api/app/repo/\`, using:`,
    ...ctx.b2_surface.map((entry) => `  - \`${entry.operation}\` — ${entry.why}`),
  ].join("\n");
}

function apiContract(ctx) {
  const rows = ctx.routes.map((route) => [
    `\`${route.method} ${route.path}\``,
    route.returns ? `\`${route.returns}\`` : "—",
    route.serverOnly ? "_server-only_" : `\`${route.clientRoute}\``,
  ]);

  return [
    "- Checked-in OpenAPI artifact: `docs/api/openapi.json`",
    "- Export / check: `pnpm contract:export` / `pnpm contract:check`",
    "- Generate the client seam from it: `pnpm gen:api` (drift gate: `pnpm gen:check`)",
    "- FastAPI freshness test: `services/api/tests/test_openapi_contract.py`",
    "- Frontend route drift test: `apps/web/src/lib/api-contract.test.ts`",
    "",
    "The FastAPI routers and Pydantic models are the single source of truth. The",
    "frontend's `API_CLIENT_ROUTES` registry, the `qk` query-key factory and the",
    "shared TypeScript types are **generated** from the exported artifact by",
    "`pnpm gen:api`, so the client cannot drift from the backend — there is no",
    "hand-written copy left to disagree. The two contract tests are kept as a",
    "belt-and-braces check that the generated files and the committed artifact are",
    "still in step.",
    "",
    table(["Route", "Returns", "Generated client route"], rows),
  ].join("\n");
}

function canonicalFiles(ctx) {
  return [
    "Hand-written — this is the file to edit:",
    "",
    "- Layered API handler: `services/api/app/runtime/`",
    "- Service orchestration: `services/api/app/service/`",
    "- B2 data access (repo layer): `services/api/app/repo/b2_client.py`",
    "- Pydantic models: `services/api/app/types/` (`base.py` carries the response-model config)",
    "- Config (pydantic-settings): `services/api/app/config/settings.py`",
    "- Structural tests: `services/api/tests/test_structure.py`",
    "- OpenAPI exporter: `services/api/scripts/export_openapi.py`",
    "- Frontend API client — error policy, transport, fallback: `apps/web/src/lib/api-client.ts`",
    "- Frontend data layer — caching, invalidation, polling: `apps/web/src/lib/queries.ts`",
    "- Shared type barrel: `packages/shared/src/types.ts`",
    "- Generator policy: `scripts/gen/api-gen.config.json`",
    "- Sample manifest behind the generated docs: `docs/exec-plans/sample.json`",
    "",
    "Generated — **never hand-edit**; change the source and re-run the command:",
    "",
    "- `docs/api/openapi.json` — `pnpm contract:export` (source: the routers and models)",
    "- `packages/shared/src/generated/api-types.ts` — `pnpm gen:api`",
    "- `apps/web/src/lib/generated/api-routes.ts` — `pnpm gen:api`",
    "- `apps/web/src/lib/generated/query-keys.ts` — `pnpm gen:api`",
    `- The marker-delimited regions of this file, \`AGENTS.md\`, \`README.md\` and the ${ctx.deployment_targets.length} \`infra/\` runbooks — \`pnpm gen:docs\``,
  ].join("\n");
}

function coreFeatures(ctx) {
  return ctx.features
    .map((feature) => `- [${feature.title}](${feature.doc}) — ${feature.summary}`)
    .join("\n");
}

const TARGET_LABEL = { vercel: "Vercel deployment contract", railway: "Railway delivery contract" };

function references(ctx) {
  return [
    "- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation",
    "- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations",
    "- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions",
    ...ctx.deployment_targets.map(
      (target) =>
        `- [infra/${target}/README.md](infra/${target}/README.md) — ${TARGET_LABEL[target] ?? `${target} delivery contract`}`,
    ),
  ].join("\n");
}

export const architecture = {
  file: "ARCHITECTURE.md",
  regions: {
    "arch-components": components,
    "arch-directory": directory,
    "arch-data-stores": dataStores,
    "arch-external-services": externalServices,
    "arch-api-contract": apiContract,
    "arch-canonical-files": canonicalFiles,
    "arch-core-features": coreFeatures,
    "arch-references": references,
  },
};
