import { describe, expect, it } from "vitest";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";

describe("app identity", () => {
  it("ships the canonical starter-kit name and template description", () => {
    expect(APP_NAME).toBe("Vibe Coding Starter Kit");
    expect(APP_DESCRIPTION).toBe(
      "File management dashboard template powered by Backblaze B2"
    );
  });
});
