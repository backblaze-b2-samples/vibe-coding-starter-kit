import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["json", { outputFile: "./playwright-results/results.json" }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    screenshot: "on",
    trace: "on-first-retry",
    video: "off",
  },
  outputDir: "./playwright-results/artifacts",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    cwd: "../../",
  },
});
