#!/usr/bin/env tsx
// Post-test artifact uploader for the B2 Verification Dashboard.
// Run automatically via `pnpm verify` after Playwright tests complete.
// Reads playwright-results/results.json, builds a summary, and uploads
// to B2 under verification-runs/{YYYY-MM-DD}--{runId}/.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";

const REPO_ROOT = resolve(import.meta.dirname, "..");
config({ path: join(REPO_ROOT, ".env") });

const RESULTS_DIR = join(REPO_ROOT, "apps/web/playwright-results");
const RESULTS_JSON = join(RESULTS_DIR, "results.json");
const SCREENSHOTS_DIR = join(RESULTS_DIR, "screenshots");
const ARTIFACTS_DIR = join(RESULTS_DIR, "artifacts");

const BUCKET = process.env.B2_BUCKET_NAME ?? "";
const ENDPOINT = process.env.B2_ENDPOINT ?? process.env.B2_S3_ENDPOINT ?? "";
const KEY_ID = process.env.B2_KEY_ID ?? process.env.B2_APPLICATION_KEY_ID ?? "";
const APP_KEY = process.env.B2_APPLICATION_KEY ?? "";

if (!BUCKET || !ENDPOINT || !KEY_ID || !APP_KEY) {
  console.error("Missing B2 credentials — set B2_ENDPOINT, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME in .env");
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: "auto",
  credentials: { accessKeyId: KEY_ID, secretAccessKey: APP_KEY },
  forcePathStyle: true,
});

async function uploadFile(key: string, body: Buffer | string, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

async function uploadDir(localDir: string, b2Prefix: string, contentType: string) {
  let entries: string[];
  try {
    entries = readdirSync(localDir);
  } catch {
    return; // directory doesn't exist
  }
  for (const name of entries) {
    const fullPath = join(localDir, name);
    if (statSync(fullPath).isFile()) {
      const body = readFileSync(fullPath);
      await uploadFile(`${b2Prefix}${name}`, body, contentType);
    }
  }
}

function gitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "local";
  }
}

async function main() {
  let results: Record<string, unknown> = {};
  try {
    results = JSON.parse(readFileSync(RESULTS_JSON, "utf8"));
  } catch {
    console.error(`Could not read ${RESULTS_JSON} — run pnpm test:e2e first`);
    process.exit(1);
  }

  const stats = (results.stats as Record<string, unknown>) ?? {};
  const total = Number(stats.expected ?? 0) + Number(stats.unexpected ?? 0) + Number(stats.skipped ?? 0);
  const passed = Number(stats.expected ?? 0);
  const failed = Number(stats.unexpected ?? 0);
  const skipped = Number(stats.skipped ?? 0);
  const duration = Number(stats.duration ?? 0) / 1000;

  const today = new Date().toISOString().slice(0, 10);
  const runId = `${today}--${randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();
  const sha = gitSha();

  const summary = { run_id: runId, timestamp, total, passed, failed, skipped, duration, git_sha: sha };
  const runPrefix = `verification-runs/${runId}/`;

  console.log(`\nUploading verification run: ${runId}`);

  await uploadFile(`${runPrefix}summary.json`, JSON.stringify(summary, null, 2), "application/json");
  await uploadFile(`${runPrefix}results.json`, readFileSync(RESULTS_JSON), "application/json");

  const uploadArtifacts = failed > 0 || process.env.VERIFY_RECORD === "1";
  if (uploadArtifacts) {
    await uploadDir(SCREENSHOTS_DIR, `${runPrefix}screenshots/`, "image/png");
    await uploadDir(ARTIFACTS_DIR, `${runPrefix}traces/`, "application/zip");
  }

  const resultStr = failed > 0 ? ` — ${failed} FAILED` : "";
  console.log(`Result:   ${passed}/${total} passed${resultStr}`);
  console.log(`Uploaded: summary.json, results.json${uploadArtifacts ? ", screenshots, traces" : ""}`);
  console.log(`View at:  http://localhost:3000/verify/${runId}\n`);
}

main().catch((err) => {
  console.error("upload-verify-run failed:", err);
  process.exit(1);
});
