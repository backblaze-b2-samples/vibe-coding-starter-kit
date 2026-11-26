import { expect, test, type Page } from "@playwright/test";

// State-based file browser tests (from #10). Hermetic: the API is mocked with
// page.route(), so no live API or bucket is needed.

const FILES = [
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

const STATS = {
  total_files: FILES.length,
  total_size_bytes: 717824,
  total_size_human: "701.0 KB",
  uploads_today: 0,
  total_downloads: 0,
};

// The page (port 3000) and the API (port 8000) are different origins, so a
// mocked response needs the CORS header a real API response would carry.
const CORS = { "access-control-allow-origin": "*" };

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) };
}

const isApi = (pathname: string) => (url: URL) => url.port === "8000" && url.pathname === pathname;

async function mockFiles(page: Page, handler: Parameters<Page["route"]>[1]) {
  await page.route(isApi("/files"), handler);
}

/** Answer DELETE /files-by-key (and its CORS preflight) with `status`. */
async function mockDelete(page: Page, status: number, body: unknown) {
  await page.route(isApi("/files-by-key"), (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { ...CORS, "access-control-allow-methods": "DELETE" },
      });
    }
    return route.fulfill(json(body, status));
  });
}

/** Delete the first visible file; returns how many file rows showed before. */
async function deleteFirstFile(page: Page): Promise<number> {
  await page.goto("/files");
  await expect(page.getByTestId("file-tree")).toBeVisible();
  await expect(page.getByTestId("file-row").first()).toBeVisible();
  const before = await page.getByTestId("file-row").count();
  const firstFile = page.getByTestId("file-row").first();
  await firstFile.getByRole("button", { name: /Open actions for/ }).click();
  await page.getByTestId("file-delete-btn").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  return before;
}

test.describe("File browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(isApi("/health"), (route) =>
      route.fulfill(json({ status: "healthy", b2_connected: true })),
    );
    await page.route(isApi("/files/stats"), (route) => route.fulfill(json(STATS)));
  });

  test("file browser — loading", async ({ page }) => {
    // Never fulfilled: keeps the loading state visible.
    await mockFiles(page, () => {});
    await page.goto("/files");
    await expect(page.getByTestId("file-browser-loading")).toBeVisible();
  });

  test("file browser — empty", async ({ page }) => {
    await mockFiles(page, (route) => route.fulfill(json([])));
    await page.goto("/files");
    await expect(page.getByTestId("file-browser-empty")).toBeVisible();
  });

  test("file browser — loaded", async ({ page }) => {
    await mockFiles(page, (route) => route.fulfill(json(FILES)));
    await page.goto("/files");
    await expect(page.getByTestId("file-tree")).toBeVisible();
    // The tree opens uploads/ (its two files are already most of the bucket),
    // so photo.jpg stays inside the collapsed uploads/images/ folder.
    await expect(page.getByTestId("file-row")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Preview report.pdf" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview data.csv" })).toBeVisible();
  });

  test("file browser — delete success", async ({ page }) => {
    let deletedKey: string | null = null;
    await mockFiles(page, (route) =>
      // After the delete, the refetch returns only the remaining files.
      route.fulfill(json(FILES.filter((f) => f.key !== deletedKey))),
    );
    await page.route(isApi("/files-by-key"), (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: { ...CORS, "access-control-allow-methods": "DELETE" },
        });
      }
      deletedKey = new URL(route.request().url()).searchParams.get("key");
      return route.fulfill(json({ deleted: true, key: deletedKey }));
    });

    const before = await deleteFirstFile(page);

    await expect(page.getByText(/deleted/)).toBeVisible();
    expect(FILES.map((f) => f.key)).toContain(deletedKey);
    await expect(page.getByTestId("file-row")).toHaveCount(before - 1);
  });

  test("file browser — delete error", async ({ page }) => {
    await mockFiles(page, (route) => route.fulfill(json(FILES)));
    await mockDelete(page, 500, { detail: "Failed to delete file" });

    const before = await deleteFirstFile(page);

    await expect(page.getByText(/Failed to delete/)).toBeVisible();
    await expect(page.getByTestId("file-row")).toHaveCount(before);
  });

  test("file browser — api error", async ({ page }) => {
    await mockFiles(page, (route) => route.fulfill(json({ detail: "B2 list failed" }, 500)));
    await page.goto("/files");
    await expect(page.getByTestId("file-browser-error")).toBeVisible();
  });
});
