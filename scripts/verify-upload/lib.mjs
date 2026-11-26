// Pure helpers for scripts/verify-upload.mjs (no network, no env access).
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

const CONTENT_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".zip": "application/zip",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
};
const SCREENSHOT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** Every file under `dir`, recursively (Playwright writes one folder per test). */
export function collectFiles(dir, base = dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(abs, base));
    } else if (entry.isFile()) {
      files.push({ abs, rel: abs.slice(base.length + 1).split(/[\\/]/).join("/") });
    }
  }
  return files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

/** "screenshots", "traces", or null for files that are not uploaded. */
export function classifyArtifact(rel) {
  const ext = extname(rel).toLowerCase();
  if (SCREENSHOT_EXTENSIONS.has(ext)) return "screenshots";
  if (ext === ".zip") return "traces";
  return null;
}

/** Object key for an artifact: subfolders kept (names stay unique), nothing unsafe. */
export function artifactKey(runPrefix, kind, rel) {
  const safe = rel
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, "_"))
    .join("/");
  return `${runPrefix}${kind}/${safe}`;
}

/** `YYYY-MM-DD--<8 hex>`: the pattern the API accepts for a run id. */
export function makeRunId(now = new Date()) {
  return `${now.toISOString().slice(0, 10)}--${randomBytes(4).toString("hex")}`;
}

export function summarize(results, { runId, timestamp, sha }) {
  const stats = results?.stats ?? {};
  const passed = Number(stats.expected ?? 0);
  const failed = Number(stats.unexpected ?? 0);
  const skipped = Number(stats.skipped ?? 0);
  return {
    run_id: runId,
    timestamp,
    total: passed + failed + skipped,
    passed,
    failed,
    skipped,
    duration: Number(stats.duration ?? 0) / 1000,
    git_sha: sha,
  };
}

/** The run passes only if the tests passed and the evidence was stored. */
export function finalExitCode({ testStatus, uploadOk }) {
  if (testStatus !== 0) return typeof testStatus === "number" && testStatus > 0 ? testStatus : 1;
  return uploadOk ? 0 : 1;
}

/**
 * The one B2 attribution token (`attribution_token` in
 * docs/exec-plans/sample.json). `pnpm gen:check` asserts it matches the API
 * client's `user_agent_extra`, so both S3 clients identify the same way.
 */
export function readAttributionToken(repoRoot) {
  const sample = JSON.parse(
    readFileSync(join(repoRoot, "docs", "exec-plans", "sample.json"), "utf8"),
  );
  if (!sample.attribution_token) throw new Error("sample.json has no attribution_token");
  return sample.attribution_token;
}

/** S3Client options for the B2 bucket, with the B2 custom user agent. */
export function s3ClientConfig(env, attributionToken) {
  return {
    region: env.B2_REGION,
    endpoint: `https://s3.${env.B2_REGION}.backblazeb2.com`,
    credentials: {
      accessKeyId: env.B2_APPLICATION_KEY_ID,
      secretAccessKey: env.B2_APPLICATION_KEY,
    },
    customUserAgent: attributionToken,
  };
}
