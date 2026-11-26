import path from "node:path";
import { expect, test, type Page, type Request } from "@playwright/test";

test.describe("Upload flow", () => {
  test("should display the upload page", async ({ page }) => {
    await page.goto("/upload");
    await expect(page).toHaveURL(/upload/);
  });

  test("should navigate to files page", async ({ page }) => {
    await page.goto("/files");
    await expect(page).toHaveURL(/files/);
  });

  test("should display the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});

// State-based upload tests (from #10). Hermetic: the API and the presigned B2
// PUT are mocked with page.route(), so no live API or bucket is needed. The
// upload is presign -> direct PUT -> verify (see uploadFile in lib/api-client.ts).

const FIXTURE = path.join(__dirname, "fixtures/test-image.jpg");
const STORAGE_URL = "https://storage.example.test/bucket/uploads/test-image.jpg";

// The page (port 3000) and the API (port 8000) are different origins, so a
// mocked response needs the CORS header a real API response would carry.
const CORS = { "access-control-allow-origin": "*" };

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) };
}

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

const isApi = (pathname: string) => (url: URL) => url.port === "8000" && url.pathname === pathname;

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
  test.beforeEach(async ({ page }) => {
    await page.route(isApi("/health"), (route) =>
      route.fulfill(json({ status: "healthy", b2_connected: true })),
    );
  });

  test("upload — idle", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.getByTestId("dropzone")).toBeVisible();
    await expect(page.getByTestId("upload-progress-item")).toHaveCount(0);
  });

  test("upload — in progress", async ({ page }) => {
    // Never fulfilled: the item stays in its uploading state.
    await page.route(isApi("/upload/presign"), () => {});
    await selectFixture(page);
    await expect(
      page.locator('[data-testid="upload-progress-item"][data-status="uploading"]'),
    ).toBeVisible();
  });

  test("upload — success", async ({ page }) => {
    const verified: Request[] = [];
    await page.route(isApi("/upload/presign"), (route) => route.fulfill(json(PRESIGN)));
    await mockStorage(page);
    await page.route(isApi("/upload/verify"), (route) => {
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

  test("upload — api error", async ({ page }) => {
    await page.route(isApi("/upload/presign"), (route) =>
      route.fulfill(json({ detail: "Internal server error" }, 500)),
    );
    await selectFixture(page);
    await expect(
      page.locator('[data-testid="upload-progress-item"][data-status="error"]'),
    ).toBeVisible();
  });
});
