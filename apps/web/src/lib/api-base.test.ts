import { afterEach, describe, expect, it, vi } from "vitest";

// API_BASE is resolved once at module load from the environment, so each case
// re-imports the module under a fresh env. The key case is the same-origin
// "/api" default: it lets the single-project Vercel deploy (web + API in one
// `services` project) work with no NEXT_PUBLIC_API_URL set, instead of silently
// falling back to localhost and breaking the dashboard.
describe("API_BASE resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses an explicit NEXT_PUBLIC_API_URL when set (two-project / separate origin)", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    const { API_BASE } = await import("./api-client");
    expect(API_BASE).toBe("https://api.example.com");
  });

  it("defaults to same-origin /api in a production build", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const { API_BASE } = await import("./api-client");
    expect(API_BASE).toBe("/api");
  });

  it("falls back to the local dev API port outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const { API_BASE } = await import("./api-client");
    expect(API_BASE).toBe("http://localhost:8000");
  });
});
