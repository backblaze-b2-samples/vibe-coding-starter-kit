import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  THEME_OPTIONS,
  isThemeOption,
  normalizeTheme,
} from "./theme-preference";

describe("theme-preference", () => {
  it("offers exactly the three themes next-themes can apply", () => {
    // Guard against re-introducing an option the app cannot honour: every value
    // here has to be one `setTheme()` accepts.
    expect(THEME_OPTIONS).toEqual(["light", "dark", "system"]);
  });

  it("recognises only real theme values", () => {
    expect(isThemeOption("dark")).toBe(true);
    expect(isThemeOption("grid")).toBe(false);
    expect(isThemeOption(undefined)).toBe(false);
    expect(isThemeOption(2)).toBe(false);
  });

  it("passes through a valid theme", () => {
    for (const theme of THEME_OPTIONS) {
      expect(normalizeTheme(theme)).toBe(theme);
    }
  });

  it("falls back to the default for unknown or missing values", () => {
    expect(normalizeTheme(undefined)).toBe(DEFAULT_THEME);
    expect(normalizeTheme("")).toBe(DEFAULT_THEME);
    expect(normalizeTheme("sepia")).toBe(DEFAULT_THEME);
  });
});
