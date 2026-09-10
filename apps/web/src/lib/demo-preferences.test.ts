import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_PREFERENCES_DEFAULTS,
  loadDemoPreferences,
  saveDemoPreferences,
  type DemoPreferences,
} from "./demo-preferences";

const KEY = "vibe-demo-preferences";

// jsdom is not the default test environment here, so stand up a minimal
// localStorage-backed `window` for the persistence round-trip.
function installStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadDemoPreferences", () => {
  it("returns defaults when there is no window (SSR)", () => {
    expect(loadDemoPreferences()).toEqual(DEMO_PREFERENCES_DEFAULTS);
  });

  it("returns defaults when nothing is stored", () => {
    installStorage();
    expect(loadDemoPreferences()).toEqual(DEMO_PREFERENCES_DEFAULTS);
  });

  it("round-trips a full set of values", () => {
    installStorage();
    const values: DemoPreferences = {
      displayName: "Ada Lovelace",
      bio: "first programmer",
      defaultView: "grid",
      emailOnUpload: true,
      warnNearQuota: false,
      quotaThreshold: "72",
    };
    expect(saveDemoPreferences(values)).toBe(true);
    expect(loadDemoPreferences()).toEqual(values);
  });

  it("falls back field-by-field on a partial or wrongly-typed blob", () => {
    const store = installStorage();
    store[KEY] = JSON.stringify({
      displayName: "Grace",
      defaultView: "spreadsheet", // not a valid option
      emailOnUpload: "yes", // wrong type
    });
    expect(loadDemoPreferences()).toEqual({
      ...DEMO_PREFERENCES_DEFAULTS,
      displayName: "Grace",
    });
  });

  it("returns defaults on corrupt JSON rather than throwing", () => {
    const store = installStorage();
    store[KEY] = "{not json";
    expect(loadDemoPreferences()).toEqual(DEMO_PREFERENCES_DEFAULTS);
  });
});

describe("saveDemoPreferences", () => {
  it("returns false without a window", () => {
    expect(saveDemoPreferences(DEMO_PREFERENCES_DEFAULTS)).toBe(false);
  });

  it("returns false when storage throws (blocked / quota)", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {},
      },
    });
    expect(saveDemoPreferences(DEMO_PREFERENCES_DEFAULTS)).toBe(false);
  });
});
