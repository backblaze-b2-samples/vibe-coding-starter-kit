import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const SCREENSHOTS = "playwright-results/screenshots";

const FILE_FIXTURES = [
  {
    key: "uploads/images/photo.jpg",
    filename: "photo.jpg",
    folder: "uploads/images/",
    size_bytes: 204800,
    size_human: "200.0 KB",
    content_type: "image/jpeg",
    uploaded_at: "2026-05-28T10:00:00Z",
    url: null,
  },
  {
    key: "uploads/report.pdf",
    filename: "report.pdf",
    folder: "uploads/",
    size_bytes: 512000,
    size_human: "500.0 KB",
    content_type: "application/pdf",
    uploaded_at: "2026-05-27T09:00:00Z",
    url: null,
  },
  {
    key: "uploads/data.csv",
    filename: "data.csv",
    folder: "uploads/",
    size_bytes: 1024,
    size_human: "1.0 KB",
    content_type: "text/csv",
    uploaded_at: "2026-05-26T08:00:00Z",
    url: null,
  },
];

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/health`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "healthy", b2_connected: true }) })
  );
});

test.describe("File browser", () => {
  test("file browser — loading", async ({ page }) => {
    // Never fulfill — keeps loading state visible indefinitely
    await page.route(`${API}/files?*`, () => {});
    await page.goto("/files");
    await expect(page.locator('[data-testid="file-browser-loading"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/files--loading.png`, fullPage: false });
  });

  test("file browser — empty", async ({ page }) => {
    await page.route(`${API}/files?*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) })
    );
    await page.goto("/files");
    await expect(page.locator('[data-testid="file-browser-empty"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/files--empty.png`, fullPage: false });
  });

  test("file browser — loaded", async ({ page }) => {
    await page.route(`${API}/files?*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FILE_FIXTURES) })
    );
    await page.goto("/files");
    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();
    // Three files: 2 at root level in uploads/, 1 in uploads/images/
    // The tree auto-expands top-level folders — file rows will be visible
    await expect(page.locator('[data-testid="file-row"]').first()).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/files--loaded.png`, fullPage: false });
  });

  test("file browser — delete success", async ({ page }) => {
    let requestCount = 0;
    await page.route(`${API}/files?*`, (route) => {
      requestCount++;
      // After the delete, the refetch gets only the remaining 2 files
      const body = requestCount === 1 ? FILE_FIXTURES : FILE_FIXTURES.slice(1);
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.route(`${API}/files/**`, (route) => {
      if (route.request().method() === "DELETE") {
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ deleted: true, key: FILE_FIXTURES[0].key }) });
      } else {
        route.continue();
      }
    });

    await page.goto("/files");
    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();

    // Hover the first file row to reveal the dropdown trigger
    const firstRow = page.locator('[data-testid="file-row"]').first();
    await firstRow.hover();
    await firstRow.locator('button').click();

    // Click delete in the dropdown
    await page.locator('[data-testid="file-delete-btn"]').click();

    // Confirm in the AlertDialog
    await page.getByRole("button", { name: "Delete" }).last().click();

    // Wait for toast or for the file count to decrease
    await expect(page.getByText(/deleted/)).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS}/files--delete-success.png`, fullPage: false });
  });

  test("file browser — delete error", async ({ page }) => {
    await page.route(`${API}/files?*`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FILE_FIXTURES) })
    );
    await page.route(`${API}/files/**`, (route) => {
      if (route.request().method() === "DELETE") {
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "Failed to delete file" }) });
      } else {
        route.continue();
      }
    });

    await page.goto("/files");
    await expect(page.locator('[data-testid="file-tree"]')).toBeVisible();

    const firstRow = page.locator('[data-testid="file-row"]').first();
    await firstRow.hover();
    await firstRow.locator('button').click();
    await page.locator('[data-testid="file-delete-btn"]').click();
    await page.getByRole("button", { name: "Delete" }).last().click();

    await expect(page.getByText(/Failed to delete/)).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `${SCREENSHOTS}/files--delete-error.png`, fullPage: false });
  });

  test("file browser — api error", async ({ page }) => {
    await page.route(`${API}/files?*`, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "B2 list failed" }) })
    );
    await page.goto("/files");
    await expect(page.locator('[data-testid="file-browser-error"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/files--api-error.png`, fullPage: false });
  });
});
