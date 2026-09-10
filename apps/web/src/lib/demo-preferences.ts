/**
 * Illustrative "Profile" and "Preferences" settings for the starter kit.
 *
 * These controls are a deliberate DEMO. They exist to show what a settings page
 * can look like when you adapt the kit — a profile, notification and quota
 * preferences, a default file view — without pretending the kit ships the
 * backend that would make them real (there is no account system, mailer, quota
 * service, or activity log). The Settings page says so in a banner, and this
 * module persists the values to `localStorage` only: a faithful demo of the
 * client-side persistence you would later point at your own API.
 *
 * The one preference the app genuinely honours — Theme — is NOT here; it is
 * owned by `next-themes` (see `theme-preference.ts`) and applied for real.
 */

export const DEMO_VIEW_OPTIONS = ["tree", "list", "grid"] as const;
export type DemoViewOption = (typeof DEMO_VIEW_OPTIONS)[number];

export interface DemoPreferences {
  displayName: string;
  bio: string;
  defaultView: DemoViewOption;
  emailOnUpload: boolean;
  warnNearQuota: boolean;
  /** Kept as a string to match the numeric `<input>` the form binds to. */
  quotaThreshold: string;
}

export const DEMO_PREFERENCES_DEFAULTS: DemoPreferences = {
  displayName: "Anonymous",
  bio: "",
  defaultView: "tree",
  emailOnUpload: false,
  warnNearQuota: true,
  quotaThreshold: "80",
};

const STORAGE_KEY = "vibe-demo-preferences";

function isViewOption(value: unknown): value is DemoViewOption {
  return (
    typeof value === "string" &&
    (DEMO_VIEW_OPTIONS as readonly string[]).includes(value)
  );
}

/**
 * Read the stored demo preferences, tolerating a missing, corrupt, or partial
 * blob by falling back to the defaults field by field. SSR-safe: returns the
 * defaults when there is no `window`.
 */
export function loadDemoPreferences(): DemoPreferences {
  if (typeof window === "undefined") return { ...DEMO_PREFERENCES_DEFAULTS };

  let stored: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEMO_PREFERENCES_DEFAULTS };
    stored = JSON.parse(raw);
  } catch {
    return { ...DEMO_PREFERENCES_DEFAULTS };
  }
  if (typeof stored !== "object" || stored === null) {
    return { ...DEMO_PREFERENCES_DEFAULTS };
  }

  const s = stored as Record<string, unknown>;
  return {
    displayName:
      typeof s.displayName === "string"
        ? s.displayName
        : DEMO_PREFERENCES_DEFAULTS.displayName,
    bio: typeof s.bio === "string" ? s.bio : DEMO_PREFERENCES_DEFAULTS.bio,
    defaultView: isViewOption(s.defaultView)
      ? s.defaultView
      : DEMO_PREFERENCES_DEFAULTS.defaultView,
    emailOnUpload:
      typeof s.emailOnUpload === "boolean"
        ? s.emailOnUpload
        : DEMO_PREFERENCES_DEFAULTS.emailOnUpload,
    warnNearQuota:
      typeof s.warnNearQuota === "boolean"
        ? s.warnNearQuota
        : DEMO_PREFERENCES_DEFAULTS.warnNearQuota,
    quotaThreshold:
      typeof s.quotaThreshold === "string"
        ? s.quotaThreshold
        : DEMO_PREFERENCES_DEFAULTS.quotaThreshold,
  };
}

/**
 * Persist the demo preferences to `localStorage`. Returns `false` when there is
 * no `window` or storage is blocked (private mode / quota), so the caller can
 * report the failure honestly rather than claiming a save that did not happen.
 */
export function saveDemoPreferences(values: DemoPreferences): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}
