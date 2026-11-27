import path from "node:path";
import type { Page, Request } from "@playwright/test";

import { CORS, expect, json, test } from "./fixtures/mock-api";

// State-based upload tests (from #10). Hermetic: the API is mocked through the
// `api` fixture (any unmocked API call is aborted and fails the test, see
// fixtures/mock-api.ts) and the presigned B2 PUT goes to a mocked placeholder
// host. The upload is presign -> direct PUT -> verify (uploadFile in
// lib/api-client.ts).

const FIXTURE = path.join(__dirname, "fixtures/test-image.jpg");
const STORAGE_URL = "https://storage.example.test/bucket/uploads/test-image.jpg";

const PRESIGN = {
  key: "uploads/test-image.jpg",
  url: STORAGE_URL,
  method: "PUT",
  content_type: "image/jpeg",
  headers: { "Content-Type": "image/jpeg" },
  expires_in: 600,
};

const UPLOADED = {
  key: "uploads/test-image.jpg",
  filename: "test-image.jpg",
  size_bytes: 331,
  size_human: "331 B",
  content_type: "image/jpeg",
  uploaded_at: "2026-05-28T10:00:00Z",
  url: null,
  metadata: null,
};

async function mockStorage(page: Page) {
  await page.route(STORAGE_URL, (route) =>
    route.fulfill({
      status: 200,
      headers: {
        ...CORS,
        "access-control-allow-methods": "PUT",
        "access-control-allow-headers": "content-type",
      },
      body: "",
    }),
  );
}

async function selectFixture(page: Page) {
  await page.goto("/upload");
  await expect(page.getByTestId("dropzone")).toBeVisible();
  await page.getByTestId("dropzone").locator('input[type="file"]').setInputFiles(FIXTURE);
}

test.describe("Upload states", () => {
  test.beforeEach(async ({ api }) => {
    await api.route("/health", (route) =>
      route.fulfill(json({ status: "healthy", b2_connected: true })),
    );
  });

  test("upload — idle", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.getByTestId("dropzone")).toBeVisible();
    await expect(page.getByTestId("upload-progress-item")).toHaveCount(0);
  });

  test("upload — in progress", async ({ page, api }) => {
    // Never fulfilled: the item stays in its uploading state.
    await api.route("/upload/presign", () => {});
    await selectFixture(page);
    await expect(
      page.locator('[data-testid="upload-progress-item"][data-status="uploading"]'),
    ).toBeVisible();
  });

  test("upload — success", async ({ page, api }) => {
    const verified: Request[] = [];
    await api.route("/upload/presign", (route) => route.fulfill(json(PRESIGN)));
    await mockStorage(page);
    await api.route("/upload/verify", (route) => {
      verified.push(route.request());
      return route.fulfill(json(UPLOADED));
    });
    await selectFixture(page);
    await expect(
      page.locator('[data-testid="upload-progress-item"][data-status="complete"]'),
    ).toBeVisible();
    expect(verified).toHaveLength(1);
    expect(verified[0].postDataJSON()).toEqual({ key: PRESIGN.key });
  });

  test("upload — api error", async ({ page, api }) => {
    await api.route("/upload/presign", (route) =>
      route.fulfill(json({ detail: "Internal server error" }, 500)),
    );
    await selectFixture(page);
    await expect(
      page.locator('[data-testid="upload-progress-item"][data-status="error"]'),
    ).toBeVisible();
  });
});
