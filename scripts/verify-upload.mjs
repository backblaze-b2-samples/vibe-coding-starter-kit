#!/usr/bin/env node
// Live verification uploader. Run via: pnpm verify:upload
//
// Runs this app's Playwright suite, then stores the evidence in the B2 bucket
// under verification-runs/<run id>/ so the /verify dashboard can show it:
//   summary.json, results.json   always
//   screenshots/, traces/        when a test failed, or with VERIFY_RECORD=1
//
// Evidence is uploaded even when tests fail (that is when it matters), and the
// command's own exit code is non-zero if the tests failed OR the upload failed.
// This is NOT part of `pnpm verify`, which stays credential-free.
//
// Needs the B2 variables from `.env` (listed in
// services/api/app/config/b2_required_vars.json) and Playwright's browser.
// `--upload-only` skips the test run and uploads results that already exist
// (for example from CI).

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  artifactKey,
  classifyArtifact,
  collectFiles,
  contentTypeFor,
  finalExitCode,
  makeRunId,
  summarize,
} from "./verify-upload/lib.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_DIR = join(REPO_ROOT, "apps", "web");
const RESULTS_JSON = join(WEB_DIR, "playwright-results", "results.json");
const ARTIFACTS_DIR = join(WEB_DIR, "test-results");
// The B2 variables and the placeholder values .env.example ships come from the
// same file the API and `pnpm run doctor` read.
const B2_VARS = JSON.parse(
  readFileSync(join(REPO_ROOT, "services", "api", "app", "config", "b2_required_vars.json"), "utf8"),
).required;

function loadEnvFile() {
  const envPath = join(REPO_ROOT, ".env");
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

function gitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 12);
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "local";
  }
}

function runTests() {
  const result = spawnSync("pnpm", ["test:e2e"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: RESULTS_JSON },
  });
  return result.status;
}

async function upload() {
  const missing = B2_VARS.filter(
    ({ env, placeholder }) => !process.env[env] || process.env[env] === placeholder,
  ).map(({ env }) => env);
  if (missing.length > 0) {
    console.error(`Missing or placeholder B2 configuration: ${missing.join(", ")} (set real values in .env).`);
    return false;
  }
  if (!existsSync(RESULTS_JSON)) {
    console.error(`No ${RESULTS_JSON}; the test run produced no JSON report.`);
    return false;
  }

  const results = JSON.parse(readFileSync(RESULTS_JSON, "utf8"));
  const runId = makeRunId();
  const summary = summarize(results, {
    runId,
    timestamp: new Date().toISOString(),
    sha: gitSha(),
  });
  const runPrefix = `verification-runs/${runId}/`;

  const s3 = new S3Client({
    region: process.env.B2_REGION,
    endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
    credentials: {
      accessKeyId: process.env.B2_APPLICATION_KEY_ID,
      secretAccessKey: process.env.B2_APPLICATION_KEY,
    },
  });
  const put = (key, body, file) =>
    s3.send(
      new PutObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentTypeFor(file),
      }),
    );

  try {
    await put(`${runPrefix}summary.json`, JSON.stringify(summary, null, 2), "summary.json");
    await put(`${runPrefix}results.json`, readFileSync(RESULTS_JSON), "results.json");

    let artifacts = 0;
    if (summary.failed > 0 || process.env.VERIFY_RECORD === "1") {
      for (const { abs, rel } of collectFiles(ARTIFACTS_DIR)) {
        const kind = classifyArtifact(rel);
        if (kind) {
          await put(artifactKey(runPrefix, kind, rel), readFileSync(abs), rel);
          artifacts += 1;
        }
      }
    }

    console.log(`\nVerification run ${runId}: ${summary.passed}/${summary.total} passed, ${summary.failed} failed`);
    console.log(`Uploaded summary.json, results.json and ${artifacts} artifact file(s).`);
    console.log(`View at: ${process.env.VERIFY_WEB_URL ?? "http://localhost:3000"}/verify/${runId}`);
    return true;
  } catch (error) {
    console.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

loadEnvFile();
const testStatus = process.argv.includes("--upload-only") ? 0 : runTests();
const uploadOk = await upload();
process.exit(finalExitCode({ testStatus, uploadOk }));
