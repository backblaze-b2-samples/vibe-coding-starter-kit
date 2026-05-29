import { test, expect } from "@playwright/test";
import path from "path";

const API = "http://localhost:8000";
const SCREENSHOTS = "playwright-results/screenshots";
const FIXTURE = path.join(__dirname, "fixtures/test-image.jpg");

const UPLOAD_RESPONSE = {
  key: "uploads/test-image.jpg",
  filename: "test-image.jpg",
  size_bytes: 331,
  size_human: "331 B",
  content_type: "image/jpeg",
  uploaded_at: "2026-05-28T10:00:00Z",
  url: null,
  metadata: null,
};

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/health`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "healthy", b2_connected: true }) })
  );
});

test.describe("Upload", () => {
  test("upload — idle", async ({ page }) => {
    await page.goto("/upload");
    await expect(page.locator('[data-testid="dropzone"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/upload--idle.png`, fullPage: false });
  });

  test("upload — in progress", async ({ page }) => {
    await page.route(`${API}/upload`, async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(UPLOAD_RESPONSE),
      });
    });
    await page.goto("/upload");
    await page.setInputFiles('[data-testid="dropzone"] input[type="file"]', FIXTURE);
    await expect(page.locator('[data-testid="upload-progress-item"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/upload--in-progress.png`, fullPage: false });
  });

  test("upload — success", async ({ page }) => {
    await page.route(`${API}/upload`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(UPLOAD_RESPONSE),
      })
    );
    await page.goto("/upload");
    await page.setInputFiles('[data-testid="dropzone"] input[type="file"]', FIXTURE);
    await expect(page.locator('[data-testid="upload-progress-item"][data-status="complete"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/upload--success.png`, fullPage: false });
  });

  test("upload — api error", async ({ page }) => {
    await page.route(`${API}/upload`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal server error" }),
      })
    );
    await page.goto("/upload");
    await page.setInputFiles('[data-testid="dropzone"] input[type="file"]', FIXTURE);
    await expect(page.locator('[data-testid="upload-progress-item"][data-status="error"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/upload--api-error.png`, fullPage: false });
  });
});
