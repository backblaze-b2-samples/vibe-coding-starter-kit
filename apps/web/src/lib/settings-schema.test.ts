import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it } from "vitest";

import { settingsSchema, type SettingsValues } from "@/lib/settings-schema";

const valid: SettingsValues = {
  displayName: "Ada Lovelace",
  bio: "Writes notes on the Analytical Engine.",
  theme: "dark",
  defaultView: "grid",
  emailOnUpload: true,
  warnNearQuota: false,
  quotaThreshold: "80",
};

// The resolver is what the form actually runs, so exercise it the way
// react-hook-form calls it rather than only `safeParse`.
async function resolve(values: unknown) {
  const resolver = zodResolver(settingsSchema);
  return resolver(values as SettingsValues, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  });
}

describe("settingsSchema", () => {
  it("accepts a complete valid form, with or without a bio", async () => {
    expect(settingsSchema.safeParse(valid).success).toBe(true);
    const { bio: _bio, ...withoutBio } = valid;
    expect(settingsSchema.safeParse(withoutBio).success).toBe(true);

    const result = await resolve(valid);
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(valid);
  });

  it("reports the custom messages through the form resolver", async () => {
    const result = await resolve({
      ...valid,
      displayName: "A",
      bio: "x".repeat(161),
      quotaThreshold: "abc",
    });

    expect(result.values).toEqual({});
    expect(result.errors.displayName?.message).toBe(
      "Display name must be at least 2 characters",
    );
    expect(result.errors.bio?.message).toBe(
      "Bio must be 160 characters or fewer",
    );
    expect(result.errors.quotaThreshold?.message).toBe("Must be a number");
  });

  it("applies the quota range refinement only to numeric input", async () => {
    const tooLow = await resolve({ ...valid, quotaThreshold: "49" });
    expect(tooLow.errors.quotaThreshold?.message).toBe(
      "Must be between 50 and 95",
    );
    const tooHigh = await resolve({ ...valid, quotaThreshold: "96" });
    expect(tooHigh.errors.quotaThreshold?.message).toBe(
      "Must be between 50 and 95",
    );
    for (const edge of ["50", "95"]) {
      expect(settingsSchema.safeParse({ ...valid, quotaThreshold: edge }).success).toBe(true);
    }
  });

  it("rejects values outside the enums and over-long names", async () => {
    expect(settingsSchema.safeParse({ ...valid, theme: "sepia" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, defaultView: "table" }).success).toBe(false);
    expect(
      settingsSchema.safeParse({ ...valid, displayName: "n".repeat(51) }).success,
    ).toBe(false);
    expect(settingsSchema.safeParse({ ...valid, emailOnUpload: "yes" }).success).toBe(false);
  });
});
