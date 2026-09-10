import { describe, expect, it } from "vitest";

import {
  SLOW_LOAD_MS,
  VERY_SLOW_LOAD_MS,
  loadingCopy,
  loadingPhase,
} from "./loading-progress";

describe("loadingPhase", () => {
  it("escalates at the documented thresholds", () => {
    expect(loadingPhase(0)).toBe("starting");
    expect(loadingPhase(SLOW_LOAD_MS - 1)).toBe("starting");
    expect(loadingPhase(SLOW_LOAD_MS)).toBe("slow");
    expect(loadingPhase(VERY_SLOW_LOAD_MS - 1)).toBe("slow");
    expect(loadingPhase(VERY_SLOW_LOAD_MS)).toBe("very-slow");
    expect(loadingPhase(60_000)).toBe("very-slow");
  });
});

describe("loadingCopy", () => {
  it("always returns a visible message naming what is loading", () => {
    for (const elapsed of [0, SLOW_LOAD_MS, VERY_SLOW_LOAD_MS, 30_000]) {
      const { message } = loadingCopy(elapsed, "files");
      expect(message).not.toBe("");
      expect(message).toContain("files");
    }
  });

  it("says nothing extra while the wait is still short", () => {
    expect(loadingCopy(0, "files")).toEqual({
      message: "Loading files…",
      hint: null,
    });
  });

  it("explains the wait once it passes the slow threshold", () => {
    const { message, hint } = loadingCopy(SLOW_LOAD_MS, "files");
    expect(message).toBe("Still loading files…");
    expect(hint).toMatch(/every object/i);
  });

  it("warns that a very long wait is still normal, not hung", () => {
    const { message, hint } = loadingCopy(VERY_SLOW_LOAD_MS, "bucket stats");
    expect(message).toBe("Still loading bucket stats…");
    expect(hint).toMatch(/20 seconds/);
    expect(hint).toMatch(/cached/i);
  });
});
