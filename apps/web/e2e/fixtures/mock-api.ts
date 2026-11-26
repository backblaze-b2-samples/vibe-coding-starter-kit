/**
 * Hermetic API mocking for the committed E2E specs.
 *
 * Import `test` and `expect` from here instead of `@playwright/test`. Every
 * spec then gets an `api` fixture and a fail-closed guard:
 *
 *   - `api.route("/files", handler)` serves one API path. It matches by
 *     pathname on ANY origin other than the web app's own, so it keeps working
 *     when `scripts/dev.sh` moves the API off port 8000 (8000 busy) and points
 *     `NEXT_PUBLIC_API_URL` at the new port.
 *   - Every other request that leaves the web app's origin (or hits a
 *     same-origin `/api/...` path) and no mock served is aborted before it
 *     reaches the network, and the test fails listing it. A spec therefore can
 *     never send a real DELETE or upload to a running API or a real bucket.
 *
 * Same-origin requests (pages, `_next/` assets, RSC payloads) are untouched.
 * Mock a non-API URL (for example the presigned storage URL of an upload) with
 * `page.route(url, ...)` as usual; it takes precedence over the guard.
 */
import { test as base, expect, type Page, type Route } from "@playwright/test";

// The page and the API are different origins, so a mocked response needs the
// CORS header a real API response would carry.
export const CORS = { "access-control-allow-origin": "*" };

export function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) };
}

type Handler = (route: Route) => unknown;

export type ApiMock = {
  /** Serve `pathname` (exact match, query ignored) on the API origin. */
  route: (pathname: string, handler: Handler) => Promise<void>;
  /** Requests the guard aborted because no mock served them. */
  unmocked: string[];
};

function isOffOrigin(url: URL, webOrigin: string) {
  return url.origin !== webOrigin || url.pathname.startsWith("/api/");
}

async function installGuard(page: Page, webOrigin: string, unmocked: string[]) {
  // Registered first, so every later page.route() (the mocks) wins over it.
  await page.route(
    (url) => isOffOrigin(url, webOrigin),
    (route) => {
      const request = route.request();
      unmocked.push(`${request.method()} ${request.url()}`);
      return route.abort("blockedbyclient");
    },
  );
}

export const test = base.extend<{ api: ApiMock }>({
  api: [
    async ({ page, baseURL }, use) => {
      if (!baseURL) throw new Error("mock-api: Playwright baseURL is not set");
      const webOrigin = new URL(baseURL).origin;
      const unmocked: string[] = [];
      await installGuard(page, webOrigin, unmocked);

      await use({
        unmocked,
        route: async (pathname, handler) => {
          await page.route(
            (url) => isOffOrigin(url, webOrigin) && url.pathname === pathname,
            (route) => {
              // CORS preflight for non-simple requests (DELETE, JSON POST).
              if (route.request().method() === "OPTIONS") {
                return route.fulfill({
                  status: 204,
                  headers: {
                    ...CORS,
                    "access-control-allow-methods": "GET, POST, PUT, DELETE",
                    "access-control-allow-headers": "content-type",
                  },
                });
              }
              return handler(route);
            },
          );
        },
      });

      expect(unmocked, "requests left the web app without a mock (aborted)").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
