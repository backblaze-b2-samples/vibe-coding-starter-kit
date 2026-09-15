/**
 * Generated regions of the `infra/*` delivery runbooks.
 *
 * These two documents are frozen, kit-owned runbooks: roughly nine tenths of
 * each is platform behaviour that is identical in every clone — topology,
 * build gates, promotion and rollback, the human-approval rules — and
 * rewriting that per app is pure waste. So only the few app-shaped parts are
 * generated: the service/topology tables, the variable tables (which the
 * manifest's `secret` flag splits), the bucket-CORS command, and the
 * deploy-button parameters.
 */
import { table } from "./context.mjs";

/** Variables every deployment of this kit configures beyond the app's own. */
const PLATFORM_VARS = {
  vercel: [
    [
      "API",
      "`MAX_FILE_SIZE`",
      "Optional configuration",
      "Uploads go directly to B2 (presigned PUT), so the platform's Function payload limit no longer applies — leave at the default or set your own cap.",
    ],
    [
      "API",
      "`WARM_LIST_CACHE_ON_STARTUP=false`",
      "Recommended on this platform",
      "Avoid an expensive full B2 scan on each cold start.",
    ],
    [
      "API",
      "`DOWNLOAD_COUNT_FILE=/tmp/download_count.json`",
      "Optional ephemeral configuration",
      "Lets a warm Function instance write the counter, but it is not durable or shared.",
    ],
  ],
  railway: [
    [
      "API",
      "`API_CORS_ORIGINS`, `API_CORS_ORIGIN_REGEX`",
      "Non-secret service configuration",
      "Set the exact web origin per environment; never a broad production origin to cover rotating previews.",
    ],
    [
      "API",
      "rate and size settings",
      "Non-secret service configuration",
      "`RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_WRITE_PER_MINUTE`, `MAX_FILE_SIZE`.",
    ],
  ],
};

/**
 * Railway configures variables per service, so its table carries a leading
 * Service column; the single-origin platform has one surface and does not.
 * A `NEXT_PUBLIC_*` variable is a web build-time value, everything else is
 * read by the API.
 */
function variableRows(ctx, target, { perService = false } = {}) {
  const rows = [];
  const secrets = ctx.secretVars.map((variable) => `\`${variable.name}\``);

  if (secrets.length > 0) {
    rows.push([
      "API",
      secrets.join(", "),
      "**Secret**",
      "Restrict the B2 key to the intended bucket and least privilege.",
    ]);
  }

  for (const variable of ctx.publicVars) {
    rows.push([
      variable.name.startsWith("NEXT_PUBLIC_") ? "Web" : "API",
      `\`${variable.name}\``,
      variable.name.startsWith("NEXT_PUBLIC_")
        ? "Public build-time configuration"
        : "Non-secret configuration",
      `${variable.note}.`,
    ]);
  }

  rows.push([
    "API",
    "`ENABLE_DOCS`, `ALLOWED_KEY_PREFIX`",
    "Non-secret configuration",
    `Set \`ENABLE_DOCS=false\` in production. \`ALLOWED_KEY_PREFIX=${ctx.b2_key_prefix}\` confines key operations when the bucket is shared.`,
  ]);

  rows.push(...(PLATFORM_VARS[target] ?? []));

  if (perService) {
    return table(["Service", "Variable names", "Classification", "Notes"], rows);
  }

  return table(
    ["Variable names", "Classification", "Notes"],
    rows.map((row) => row.slice(1)),
  );
}

/** One helper invocation, shared by both runbooks so they cannot disagree. */
function corsCommand(origin) {
  return [
    "```bash",
    `python services/api/scripts/setup_b2_cors.py --origin ${origin} --apply`,
    "```",
  ].join("\n");
}

function vercelServices() {
  return table(
    ["Service", "Root directory", "Framework", "Public path", "Health check"],
    [
      ["`web`", "`apps/web`", "Next.js", "`/`", "`/`"],
      ["`api`", "`services/api`", "FastAPI", "`/api/*`", "`/api/health`"],
    ],
  );
}

function vercelDeployButton(ctx) {
  const envList = ctx.requiredVars.map((variable) => `\`${variable.name}\``).join(", ");
  const presentation = [
    "`project-name`",
    "`repository-name`",
    "`demo-title`",
    "`demo-description`",
  ];

  if (ctx.screenshots.length > 0) {
    presentation.push("`demo-image`");
  }

  const lines = [
    table(["`root-directory`", "Pre-filled `env`"], [["_(none — repo root)_", envList]]),
    "",
    "Alongside `repository-url` and the `env` list, the button carries the",
    "presentation parameters the clone flow renders in its preview card:",
    `${presentation.slice(0, 2).join(" and ")} (both \`${ctx.slug}\`, so the cloned repo and`,
    "the created Project get a readable default name), plus",
    `${presentation.slice(2).join(", ")}.`,
  ];

  if (ctx.screenshots.length === 0) {
    lines.push(
      "",
      "There is no `demo-image`: this repository ships no screenshots yet, and a",
      "button parameter pointing at a file that does not exist renders a broken",
      "card. Add entries to `docs/exec-plans/sample.json` `screenshots` and re-run",
      "`pnpm gen:docs` to include one.",
    );
  } else {
    lines.push(
      "",
      `\`demo-image\` points at \`${ctx.screenshots[0].path}\`, resolved against this`,
      "repository's default branch.",
    );
  }

  lines.push(
    "",
    "There is no `demo-url`: this repository hosts no public demo deployment, and",
    "the API is unauthenticated and bucket-wide (see",
    "[Variables and Public Exposure](#variables-and-public-exposure)), so a",
    "casually exposed demo origin is a liability rather than a feature. Any future",
    "demo needs its own throwaway bucket/prefix, a no-delete key, and lifecycle",
    "cleanup before a `demo-url` is added.",
  );

  return lines.join("\n");
}

function railwayServices() {
  return table(
    ["Service", "Root directory", "Config file", "Build / start", "Health check"],
    [
      [
        "`web`",
        "`/`",
        "`railway.json`",
        "root pnpm workspace build; `next start` on Railway's `PORT`",
        "`/`",
      ],
      [
        "`api`",
        "`/services/api`",
        "`services/api/railway.json`",
        "`pip install -r requirements.lock`; Uvicorn on Railway's `PORT`",
        "`/health`",
      ],
    ],
  );
}

export const infraRunbooks = [
  {
    file: "infra/vercel/README.md",
    regions: {
      "vercel-services": vercelServices,
      "vercel-variables": (ctx) => variableRows(ctx, "vercel"),
      "vercel-cors-command": () => corsCommand("https://your-app.vercel.app"),
      "vercel-deploy-button": vercelDeployButton,
    },
  },
  {
    file: "infra/railway/README.md",
    regions: {
      "railway-services": railwayServices,
      "railway-variables": (ctx) => variableRows(ctx, "railway", { perService: true }),
      "railway-cors-command": () => corsCommand("https://<web-domain>"),
    },
  },
];
