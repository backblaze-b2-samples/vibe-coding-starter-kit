#!/usr/bin/env node
// Preflight environment check — runs automatically before `pnpm dev`.
// Surfaces every common starter-kit setup gotcha *before* uvicorn or
// next try to start, with actionable error messages.
//
// Zero dependencies (uses only node:* core modules) so this works on a
// fresh clone before anyone has run `pnpm install`.
//
// Run directly:  node scripts/doctor.mjs
// Run via pnpm:  pnpm run doctor  (`pnpm doctor` is a built-in pnpm command
//                before pnpm 11, so the bare form would not run this script)

import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BIND_DENIED_FIX, formatBindDiagnostic, probeBind } from "./local-bind.mjs";
import {
  findPython,
  isSupportedPython,
  readPythonVersion,
  REQUIRED_PYTHON_MINOR,
} from "./python-runtime.mjs";
import { parseSemver } from "./semver.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = resolve(REPO_ROOT, ".env");
const VENV_PYTHON = resolve(REPO_ROOT, "services/api/.venv/bin/python");
const VENV_UVICORN = resolve(REPO_ROOT, "services/api/.venv/bin/uvicorn");

// Required minimum versions. Bump as upstream support shifts.
const REQUIRED_NODE_MAJOR = 20;
const REQUIRED_PNPM_MAJOR = 9;
// Required B2 env vars + the exact placeholder strings shipped in
// .env.example. Keep in sync with services/api/main.py REQUIRED_B2_SETTINGS
// and PLACEHOLDER_VALUES.
const REQUIRED_B2_VARS = [
  "B2_ENDPOINT",
  "B2_KEY_ID",
  "B2_APPLICATION_KEY",
  "B2_BUCKET_NAME",
];
const PLACEHOLDERS = new Set([
  "your_b2_endpoint",
  "your_key_id",
  "your_application_key",
  "your-bucket-name",
]);

// Only Next.js: `pnpm dev` self-heals the API side via scripts/pick-port.mjs,
// so warning about 8000 here would just duplicate dev.sh's own banner.
const PORTS_TO_CHECK = [{ port: 3000, name: "Next.js dev server" }];

const failures = [];
const warnings = [];

function fail(msg, fix) {
  failures.push({ msg, fix });
}

function warn(msg, fix) {
  warnings.push({ msg, fix });
}

function tryExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// ----- Tool versions -----

function checkPlatform() {
  if (process.platform !== "win32") return;

  fail(
    "Native Windows is not supported by the local dev scripts yet",
    "Use macOS, Linux, or WSL2; the scripts expect POSIX shell and services/api/.venv/bin paths",
  );
}

function checkNode() {
  const v = parseSemver(process.version);
  if (!v || v.major < REQUIRED_NODE_MAJOR) {
    fail(
      `Node ${process.version} is too old (need >= ${REQUIRED_NODE_MAJOR}.0.0)`,
      `Install a current Node via nvm/fnm: \`nvm install ${REQUIRED_NODE_MAJOR}\``,
    );
  }
}

function checkPnpm() {
  const out = tryExec("pnpm --version");
  if (!out) {
    fail("pnpm is not installed", "Install via corepack: `corepack enable && corepack prepare pnpm@latest --activate`");
    return;
  }
  const v = parseSemver(out);
  if (!v || v.major < REQUIRED_PNPM_MAJOR) {
    fail(
      `pnpm ${out} is too old (need >= ${REQUIRED_PNPM_MAJOR})`,
      `Run: \`corepack prepare pnpm@latest --activate\``,
    );
  }
}

function checkPython() {
  const { python, found } = findPython();
  if (python) return;

  if (found.length > 0) {
    fail(
      `${found[0].text} is too old (need >= 3.${REQUIRED_PYTHON_MINOR})`,
      `Install Python 3.${REQUIRED_PYTHON_MINOR}+ via Homebrew (\`brew install python@3.12\`) or pyenv (\`pyenv install 3.${REQUIRED_PYTHON_MINOR}\`)`,
    );
  } else {
    fail(
      "Python is not on PATH",
      `Install Python 3.${REQUIRED_PYTHON_MINOR}+ from https://python.org, via Homebrew (\`brew install python@3.12\`), or pyenv`,
    );
  }
}

// ----- Project state -----

function checkVenv() {
  if (!existsSync(VENV_UVICORN)) {
    fail(
      "Backend virtualenv not set up (services/api/.venv/bin/uvicorn missing)",
      "Run: `pnpm run setup`",
    );
    return;
  }

  const existing = readPythonVersion(VENV_PYTHON);
  if (!existing) {
    fail(
      "Backend virtualenv Python is missing or not executable",
      "Move services/api/.venv aside, then run: `pnpm run setup`",
    );
    return;
  }
  if (!isSupportedPython(existing.version)) {
    fail(
      `Backend virtualenv uses ${existing.text} (need >= 3.${REQUIRED_PYTHON_MINOR})`,
      "Move services/api/.venv aside, then run: `pnpm run setup`",
    );
  }
}

function parseEnvFile(path) {
  // Minimal .env parser — enough for KEY=value lines, ignores comments
  // and quoted strings. We don't need the full dotenv grammar here.
  const out = {};
  const text = readFileSync(path, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function checkEnv() {
  if (!existsSync(ENV_FILE)) {
    fail(
      ".env is missing at the repo root",
      "Run: `pnpm run setup`, then fill in your B2 credentials",
    );
    return;
  }
  const env = parseEnvFile(ENV_FILE);
  const missing = REQUIRED_B2_VARS.filter((k) => !env[k]);
  if (missing.length > 0) {
    fail(
      `.env is missing required B2 variables: ${missing.join(", ")}`,
      "See .env.example for the full list and edit .env to add them",
    );
  }
  const placeholders = REQUIRED_B2_VARS.filter(
    (k) => env[k] && PLACEHOLDERS.has(env[k]),
  );
  if (placeholders.length > 0) {
    fail(
      `.env still has placeholder values: ${placeholders.join(", ")}`,
      "Edit .env and replace placeholders with your real B2 credentials (https://secure.backblaze.com/app_keys.htm?utm_source=github&utm_medium=referral&utm_campaign=ai_artifacts&utm_content=b2ai-oss-start)",
    );
  }
}

// ----- Network -----

// We probe the wildcard interfaces (0.0.0.0 and ::) because that's what
// `next dev` and `uvicorn` actually try to bind to. Probing only the
// loopbacks misses the common case (on macOS) where a process bound to
// `::` doesn't conflict with a `127.0.0.1` probe but DOES conflict with
// `pnpm dev`'s own wildcard bind. If either wildcard is taken, the
// port is effectively unusable for the dev server.
//
// The two probes run one after the other, never in parallel: on Linux a `::`
// bind is dual-stack by default, so it collides with a concurrently held
// `0.0.0.0` bind and every run would report a free port as busy.
async function checkPort({ port, name }) {
  const probed = [await probeBind(port, "0.0.0.0"), await probeBind(port, "::")];
  // A host with no usable IPv6 (common in containers) answers the `::` probe
  // with EAFNOSUPPORT/EADDRNOTAVAIL. That says nothing about the port, so it is
  // dropped rather than reported as busy or as a failure.
  const results = probed.filter((result) => result.status !== "unsupported");
  const denied = results.filter((result) => result.status === "denied");
  const errors = results.filter((result) => result.status === "error");
  const busy = results.some((result) => result.status === "busy");

  if (denied.length > 0) {
    fail(
      `Local bind check for port ${port} (${name}) was denied: ${denied.map(formatBindDiagnostic).join("; ")}`,
      BIND_DENIED_FIX,
    );
    return;
  }

  if (errors.length > 0) {
    fail(
      `Could not probe port ${port} (${name}): ${errors.map(formatBindDiagnostic).join("; ")}`,
      "Retry after checking local networking/firewall settings, or run in a standard macOS, Linux, or WSL2 shell",
    );
    return;
  }

  if (results.length === 0) {
    warn(
      `Could not probe port ${port} (${name}) on any interface: ${probed.map(formatBindDiagnostic).join("; ")}`,
      "ok if this host has no IPv4/IPv6 stack for local servers — `pnpm dev` will report the real bind error if it can't start.",
    );
    return;
  }

  if (busy) {
    warn(
      `Port ${port} (${name}) is already in use`,
      `ok — \`pnpm dev\` will pick the next free port automatically. ` +
        `To inspect what's on it: \`lsof -nP -iTCP:${port} -sTCP:LISTEN\`.`,
    );
  }
}

// ----- Run -----

async function main() {
  checkPlatform();
  checkNode();
  checkPnpm();
  checkPython();
  checkVenv();
  checkEnv();
  await Promise.all(PORTS_TO_CHECK.map(checkPort));

  if (failures.length === 0 && warnings.length === 0) {
    console.log("✓ doctor: environment looks good");
    return;
  }

  if (warnings.length > 0) {
    console.error("\n⚠  Warnings:");
    for (const { msg, fix } of warnings) {
      console.error(`  - ${msg}`);
      console.error(`    fix: ${fix}`);
    }
  }

  if (failures.length > 0) {
    console.error("\n✗ Errors:");
    for (const { msg, fix } of failures) {
      console.error(`  - ${msg}`);
      console.error(`    fix: ${fix}`);
    }
    console.error("");
    process.exit(1);
  }

  // Warnings only — non-fatal so `pnpm dev` can still proceed if the
  // user genuinely wants to (e.g. running a second instance).
  console.error("\nProceeding despite warnings.\n");
}

main();
