import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const SCREENSHOTS = "playwright-results/screenshots";

const RUN_FIXTURES = [
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

const RUN_DETAIL_FIXTURE = {
  ...RUN_FIXTURES[0],
  results: {},
  screenshot_urls: [
    "https://example.com/screenshots/upload--idle.png",
    "https://example.com/screenshots/files--empty.png",
  ],
  trace_urls: [],
};

const RUN_DETAIL_NO_SCREENSHOTS = {
  ...RUN_FIXTURES[1],
  results: {},
  screenshot_urls: [],
  trace_urls: [],
};

test.beforeEach(async ({ page }) => {
  await page.route(`${API}/health`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "healthy", b2_connected: true }),
    })
  );
});

test.describe("Verification dashboard", () => {
  test("verify dashboard — loading", async ({ page }) => {
    // Never fulfill — keeps loading state visible
    await page.route(`${API}/verify/runs`, () => {});
    await page.goto("/");
    await expect(page.locator('[data-testid="verify-dashboard-loading"]')).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/verify--loading.png`, fullPage: false });
  });

  test("verify dashboard — empty", async ({ page }) => {
    await page.route(`${API}/verify/runs`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );
    await page.goto("/");
    await expect(page.locator('[data-testid="verify-dashboard-empty"]')).toBeVisible();
    await expect(page.getByText("No verification runs yet.")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/verify--empty.png`, fullPage: false });
  });

  test("verify dashboard — loaded", async ({ page }) => {
    await page.route(`${API}/verify/runs`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(RUN_FIXTURES),
      })
    );
    await page.goto("/");
    await expect(page.locator('[data-testid="verify-runs-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="verify-run-row"]')).toHaveCount(2);
    await page.screenshot({ path: `${SCREENSHOTS}/verify--loaded.png`, fullPage: false });
  });

  test("verify dashboard — has failures", async ({ page }) => {
    const failRun = [
      {
        run_id: "2026-05-26--fail0001",
        timestamp: "2026-05-26T08:00:00Z",
        total: 12,
        passed: 10,
        failed: 2,
        skipped: 0,
        duration: 9.1,
        git_sha: "fail001234a",
      },
    ];
    await page.route(`${API}/verify/runs`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(failRun),
      })
    );
    await page.goto("/");
    await expect(page.locator('[data-testid="verify-run-status"]')).toBeVisible();
    await expect(page.getByText("2 failed")).toBeVisible();
    await page.screenshot({ path: `${SCREENSHOTS}/verify--has-failures.png`, fullPage: false });
  });
});

test.describe("Verification run detail", () => {
  test("verify run detail — with screenshots", async ({ page }) => {
    await page.route(`${API}/verify/runs`, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RUN_FIXTURES) })
    );
    await page.route(`${API}/verify/runs/${RUN_FIXTURES[0].run_id}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(RUN_DETAIL_FIXTURE),
      })
    );
    await page.goto(`/verify/${RUN_FIXTURES[0].run_id}`);
    await expect(page.locator('[data-testid="verify-screenshot-grid"]')).toBeVisible();
    await expect(page.locator('[data-testid="verify-screenshot"]')).toHaveCount(2);
    await page.screenshot({ path: `${SCREENSHOTS}/verify-detail--screenshots.png`, fullPage: false });
  });

  test("verify run detail — no screenshots", async ({ page }) => {
    await page.route(`${API}/verify/runs/${RUN_FIXTURES[1].run_id}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(RUN_DETAIL_NO_SCREENSHOTS),
      })
    );
    await page.goto(`/verify/${RUN_FIXTURES[1].run_id}`);
    await expect(page.locator('[data-testid="verify-no-screenshots"]')).toBeVisible();
    await page.screenshot({
      path: `${SCREENSHOTS}/verify-detail--no-screenshots.png`,
      fullPage: false,
    });
  });
});
