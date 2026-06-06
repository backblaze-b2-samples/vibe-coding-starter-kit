import { test, expect, type Page } from "@playwright/test";

// End-to-end exercise of the kit's headline feature: upload → browse → preview
// → download → delete, driven through the real UI against a real Backblaze B2
// bucket.
//
// This is a LIVE test. The Playwright webServer runs `pnpm dev`, whose
// `predev` doctor and the API's startup lifespan both refuse to boot without
// real B2 credentials in the repo-root `.env`. So if this suite runs at all,
// B2 is configured — there is no half-configured state to guard against. CI
// only schedules this job when B2 secrets are present (see
// .github/workflows/integration.yml); locally, configure `.env` first (the
// same setup `pnpm dev` needs).

// A unique name per run so the file is easy to find in the tree and never
// collides with a previous run's leftovers.
const fileName = `e2e-${Date.now()}.txt`;
const fileBody = "playwright e2e upload\n";

/** Open the row-level actions menu for the file with the given name. */
async function openRowMenu(page: Page, name: string) {
  const row = page.locator(".tree-row", { hasText: name });
  await expect(row).toBeVisible();
  await row.hover();
  // The trigger is the only button in the row (revealed on hover).
  await row.getByRole("button").click();
}

test.describe("Upload → browse → preview → download → delete", () => {
  test("round-trips a file through the UI and B2", async ({ page }) => {
    // 1. Upload via the dropzone's hidden file input.
    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(fileBody),
    });

    // Success toast confirms the round-trip to B2 completed.
    await expect(
      page.getByText(`${fileName} uploaded successfully`),
    ).toBeVisible({ timeout: 30_000 });

    // 2. The file shows up in the browser (uploads/ folder auto-expands).
    await page.goto("/files");
    await expect(page.getByText(fileName)).toBeVisible({ timeout: 30_000 });

    // 3. Preview opens a dialog with the metadata panel.
    await openRowMenu(page, fileName);
    await page.getByRole("menuitem", { name: "Preview" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Key")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // 4. Download resolves a presigned URL from the API.
    await openRowMenu(page, fileName);
    const downloadResp = page.waitForResponse(
      (r) => /\/files\/uploads\/.*\/download/.test(r.url()) && r.status() === 200,
    );
    await page.getByRole("menuitem", { name: "Download" }).click();
    await downloadResp;

    // 5. Delete (with confirm) removes it from the tree.
    await openRowMenu(page, fileName);
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(`${fileName} deleted`)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(fileName)).toHaveCount(0);
  });
});
