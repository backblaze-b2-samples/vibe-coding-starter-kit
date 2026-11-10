import { z } from "zod";

import { THEME_OPTIONS } from "@/lib/theme-preference";

/**
 * Validation for the Settings form (`components/settings/settings-form.tsx`).
 *
 * Kept outside the component so the rules and their user-facing messages are
 * unit-tested without rendering the form. See `docs/features/settings.md`.
 */
export const settingsSchema = z.object({
  displayName: z
    .string()
    .min(2, "Display name must be at least 2 characters")
    .max(50),
  bio: z.string().max(160, "Bio must be 160 characters or fewer").optional(),
  theme: z.enum(THEME_OPTIONS),
  defaultView: z.enum(["tree", "list", "grid"]),
  emailOnUpload: z.boolean(),
  warnNearQuota: z.boolean(),
  quotaThreshold: z
    .string()
    .regex(/^\d+$/, "Must be a number")
    .refine((v) => {
      const n = Number(v);
      return n >= 50 && n <= 95;
    }, "Must be between 50 and 95"),
});

export type SettingsValues = z.infer<typeof settingsSchema>;
