import { describe, expect, it } from "vitest";
import { APP_DESCRIPTION, APP_NAME, APP_SLUG } from "@/lib/app-config";

describe("app identity", () => {
  // Deliberately no copy of the name or the description here: those literals
  // live in app-config.ts alone, so a rebrand edits one file and this suite
  // still passes. What is asserted is that they are set, and that the slug is
  // derived from the name rather than declared a second time.
  it("declares a non-empty name and description", () => {
    expect(APP_NAME.trim()).not.toBe("");
    expect(APP_DESCRIPTION.trim()).not.toBe("");
  });

  it("derives a url-safe slug from the name", () => {
    expect(APP_SLUG).toBe(
      APP_NAME.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
    expect(APP_SLUG).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
