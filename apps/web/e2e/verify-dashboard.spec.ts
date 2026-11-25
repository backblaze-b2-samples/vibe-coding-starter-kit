import { expect, test, type Page } from "@playwright/test";

// The verification dashboard (/verify). Hermetic: the API is mocked with
// page.route(), so no live B2 is needed.

const RUNS = [
  {
    run_id: "2026-05-28--abc12345",
    timestamp: "2026-05-28T10:04:00Z",
    total: 12,
    passed: 12,
    failed: 0,
    skipped: 0,
    duration: 8.4,
    git_sha: "abc1234def5",
  },
  {
    run_id: "2026-05-27--def67890",
    timestamp: "2026-05-27T09:30:00Z",
    total: 12,
    passed: 10,
    failed: 2,
    skipped: 0,
    duration: 11.2,
    git_sha: "def6789abc0",
  },
];

// The page (port 3000) and the API (port 8000) are different origins, so a
// mocked response needs the CORS header a real API response would carry.
const CORS = { "access-control-allow-origin": "*" };

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    headers: CORS,
    body: JSON.stringify(body),
  };
}

async function mockRuns(page: Page, body: unknown) {
  await page.route("**/verify/runs", (route) => route.fulfill(json(body)));
}

test.describe("Verification dashboard", () => {
  test("shows a loading state while runs are pending", async ({ page }) => {
    await page.route("**/verify/runs", () => {
      // Never fulfilled: keeps the loading state visible.
    });
    await page.goto("/verify");
    await expect(page.getByTestId("verify-dashboard-loading")).toBeVisible();
  });

  test("shows the empty state", async ({ page }) => {
    await mockRuns(page, []);
    await page.goto("/verify");
    await expect(page.getByTestId("verify-dashboard-empty")).toBeVisible();
    await expect(page.getByText("No verification runs yet.")).toBeVisible();
  });

  test("lists runs with their status", async ({ page }) => {
    await mockRuns(page, RUNS);
    await page.goto("/verify");
    await expect(page.getByTestId("verify-run-row")).toHaveCount(2);
    await expect(page.getByText("All passed")).toBeVisible();
    await expect(page.getByText("2 failed")).toBeVisible();
  });

  test("shows an error state when the API fails", async ({ page }) => {
    await page.route("**/verify/runs", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: CORS,
        body: '{"detail":"boom"}',
      }),
    );
    await page.goto("/verify");
    await expect(page.getByTestId("verify-dashboard-error")).toBeVisible();
  });

  test("leaves the main dashboard at / untouched", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

test.describe("Verification run detail", () => {
  test("shows screenshots when the run has them", async ({ page }) => {
    await page.route(`**/verify/runs/${RUNS[0].run_id}`, (route) =>
      route.fulfill(
        json({
          ...RUNS[0],
          results: {},
          screenshot_urls: [
            "https://example.invalid/screenshots/upload--idle.png",
            "https://example.invalid/screenshots/files--empty.png",
          ],
          trace_urls: [],
        }),
      ),
    );
    await page.goto(`/verify/${RUNS[0].run_id}`);
    await expect(page.getByTestId("verify-screenshot-grid")).toBeVisible();
    await expect(page.getByTestId("verify-screenshot")).toHaveCount(2);
  });

  test("explains when a run has no screenshots", async ({ page }) => {
    await page.route(`**/verify/runs/${RUNS[1].run_id}`, (route) =>
      route.fulfill(json({ ...RUNS[1], results: {}, screenshot_urls: [], trace_urls: [] })),
    );
    await page.goto(`/verify/${RUNS[1].run_id}`);
    await expect(page.getByTestId("verify-no-screenshots")).toBeVisible();
  });
});
