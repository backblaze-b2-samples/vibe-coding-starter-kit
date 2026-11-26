// Tests for the pure helpers behind scripts/verify-upload.mjs.
// Run via: pnpm test:scripts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  artifactKey,
  classifyArtifact,
  collectFiles,
  contentTypeFor,
  finalExitCode,
  makeRunId,
  summarize,
} from "./lib.mjs";

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
