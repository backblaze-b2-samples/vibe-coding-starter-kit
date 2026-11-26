// Tests for the pure helpers behind scripts/verify-upload.mjs.
// Run via: pnpm test:scripts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  artifactKey,
  classifyArtifact,
  collectFiles,
  contentTypeFor,
  finalExitCode,
  makeRunId,
  readAttributionToken,
  s3ClientConfig,
  summarize,
} from "./lib.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("contentTypeFor", () => {
  it("maps by extension, case-insensitively", () => {
    assert.equal(contentTypeFor("a/b/shot.png"), "image/png");
    assert.equal(contentTypeFor("shot.JPG"), "image/jpeg");
    assert.equal(contentTypeFor("shot.jpeg"), "image/jpeg");
    assert.equal(contentTypeFor("trace.zip"), "application/zip");
    assert.equal(contentTypeFor("results.json"), "application/json");
  });

  it("falls back to octet-stream", () => {
    assert.equal(contentTypeFor("blob.bin"), "application/octet-stream");
    assert.equal(contentTypeFor("noextension"), "application/octet-stream");
  });
});

describe("collectFiles", () => {
  it("walks per-test subfolders recursively and returns relative posix paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "verify-upload-"));
    try {
      mkdirSync(join(dir, "test-one-chromium", "deep"), { recursive: true });
      mkdirSync(join(dir, "test-two-chromium"), { recursive: true });
      writeFileSync(join(dir, "test-one-chromium", "test-failed-1.png"), "x");
      writeFileSync(join(dir, "test-one-chromium", "deep", "trace.zip"), "x");
      writeFileSync(join(dir, "test-two-chromium", "test-failed-1.png"), "x");
      writeFileSync(join(dir, "top.png"), "x");
      assert.deepEqual(
        collectFiles(dir).map((f) => f.rel),
        [
          "test-one-chromium/deep/trace.zip",
          "test-one-chromium/test-failed-1.png",
          "test-two-chromium/test-failed-1.png",
          "top.png",
        ],
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns nothing for a missing directory", () => {
    assert.deepEqual(collectFiles(join(tmpdir(), "does-not-exist-verify-upload")), []);
  });
});

describe("classifyArtifact and artifactKey", () => {
  it("sends images to screenshots and zips to traces, ignoring the rest", () => {
    assert.equal(classifyArtifact("a/test-failed-1.png"), "screenshots");
    assert.equal(classifyArtifact("a/shot.webp"), "screenshots");
    assert.equal(classifyArtifact("a/trace.zip"), "traces");
    assert.equal(classifyArtifact("a/video.webm"), null);
  });

  it("keeps subfolders unique and strips unsafe characters", () => {
    const prefix = "verification-runs/2026-05-28--abc12345/";
    assert.equal(
      artifactKey(prefix, "screenshots", "test one-chromium/test-failed-1.png"),
      `${prefix}screenshots/test_one-chromium/test-failed-1.png`,
    );
    assert.equal(
      artifactKey(prefix, "traces", "../../etc/passwd.zip"),
      `${prefix}traces/etc/passwd.zip`,
    );
  });
});

describe("makeRunId", () => {
  it("is date plus eight hex characters", () => {
    const id = makeRunId(new Date("2026-05-28T10:00:00Z"));
    assert.match(id, /^2026-05-28--[0-9a-f]{8}$/);
  });
});

describe("summarize", () => {
  it("derives counts and seconds from Playwright stats", () => {
    const summary = summarize(
      { stats: { expected: 5, unexpected: 2, skipped: 1, flaky: 0, duration: 8400 } },
      { runId: "2026-05-28--abc12345", timestamp: "2026-05-28T10:00:00Z", sha: "abc1234" },
    );
    assert.deepEqual(summary, {
      run_id: "2026-05-28--abc12345",
      timestamp: "2026-05-28T10:00:00Z",
      total: 8,
      passed: 5,
      failed: 2,
      skipped: 1,
      duration: 8.4,
      git_sha: "abc1234",
    });
  });
});

describe("finalExitCode", () => {
  it("fails the run when the tests failed, even if the upload worked", () => {
    assert.notEqual(finalExitCode({ testStatus: 1, uploadOk: true }), 0);
  });

  it("fails the run when the upload failed, even if the tests passed", () => {
    assert.notEqual(finalExitCode({ testStatus: 0, uploadOk: false }), 0);
  });

  it("passes only when both succeeded", () => {
    assert.equal(finalExitCode({ testStatus: 0, uploadOk: true }), 0);
  });

  it("treats a killed test process as a failure", () => {
    assert.notEqual(finalExitCode({ testStatus: null, uploadOk: true }), 0);
  });
});

describe("s3ClientConfig", () => {
  // Placeholder values only: the request never leaves the process.
  const env = {
    B2_REGION: "us-west-004",
    B2_APPLICATION_KEY_ID: "test-key-id",
    B2_APPLICATION_KEY: "test-application-key",
  };

  it("uses the same B2 attribution token as the API's boto3 client", () => {
    const b2Client = readFileSync(join(REPO_ROOT, "services/api/app/repo/b2_client.py"), "utf8");
    const pythonToken = /user_agent_extra\s*=\s*"([^"]+)"/.exec(b2Client)?.[1];
    assert.ok(pythonToken, "b2_client.py sets user_agent_extra");
    assert.equal(readAttributionToken(REPO_ROOT), pythonToken);
  });

  it("sends the attribution token in the user agent of every request", async () => {
    const token = readAttributionToken(REPO_ROOT);
    let sent = null;
    const client = new S3Client({
      ...s3ClientConfig(env, token),
      // Stand-in transport: capture the signed request, never touch the network.
      requestHandler: {
        handle: async (request) => {
          sent = request;
          throw new Error("captured");
        },
      },
      maxAttempts: 1,
    });
    await assert.rejects(
      client.send(new PutObjectCommand({ Bucket: "b", Key: "k", Body: "x" })),
      /captured/,
    );
    assert.ok(sent, "the request reached the transport");
    const agents = [sent.headers["user-agent"], sent.headers["x-amz-user-agent"]].join(" ");
    assert.match(agents, new RegExp(`\\b${token}\\b`));
    assert.equal(sent.hostname, "s3.us-west-004.backblazeb2.com");
  });
});
