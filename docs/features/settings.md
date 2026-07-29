<!-- last_verified: 2026-07-28 -->
# Feature: Settings

## Purpose
Show what a settings page can look like when you build on this starter kit — a
profile, notification/quota preferences, and a default view — while being
explicit that only the preferences the kit can actually honour do anything. Today
that is Theme; the rest is a labelled demonstration.

## Used By
- UI: `/settings` page (`SettingsForm`, `DangerZone`)
- API: none. There is no account system
- Storage: `next-themes`' own key for Theme; `localStorage` (`vibe-demo-preferences`) for the demo fields. The app has no server-side preferences store

## Core Functions
- `apps/web/src/lib/theme-preference.ts` — `THEME_OPTIONS`, `DEFAULT_THEME`, `isThemeOption()`, `normalizeTheme()`; the one real preference
- `apps/web/src/lib/demo-preferences.ts` — `DemoPreferences`, `DEMO_PREFERENCES_DEFAULTS`, `loadDemoPreferences()`, `saveDemoPreferences()`; localStorage persistence for the illustrative fields
- `apps/web/src/components/settings/settings-form.tsx` — the form; a demo banner, the real Theme control, and the demo Profile/Preferences fields
- `apps/web/src/components/layout/theme-provider.tsx` — `next-themes` provider (the single owner of the theme)
- `apps/web/src/components/settings/danger-zone.tsx` — destructive bucket actions (demo — no real delete runs)

## Canonical Files
- Honoured-preference pattern: `apps/web/src/lib/theme-preference.ts`
- Demo-preference pattern: `apps/web/src/lib/demo-preferences.ts`

## Inputs
- theme: `"light" | "dark" | "system"` (real)
- displayName, bio, defaultView (`tree | list | grid`), emailOnUpload, warnNearQuota, quotaThreshold (demo)

## Outputs
- Side effect (real): theme applied immediately via `setTheme()`, persisted under `next-themes`' key
- Side effect (demo): the other fields written to `localStorage` only, never sent anywhere
- Toast: success naming that theme was applied and the demo values were stored in this browser; a warning toast instead when the browser blocks storage (theme still changes)

## Flow
- Page mounts → the form hydrates once: Theme from `next-themes` (the live value, so the header toggle and this form always agree), the demo fields from their `localStorage` blob
- Submit → `setTheme(theme)` applies and persists the theme; `saveDemoPreferences()` stores the rest locally; the toast reports honestly what happened
- Reload → the theme comes back, and so do the demo values (from localStorage)

## Edge Cases
- `next-themes` reports `undefined` during the first client paint → the form waits for the resolved value before hydrating
- Unknown / stale stored theme value → `normalizeTheme()` falls back to `system`
- Corrupt / partial demo blob → `loadDemoPreferences()` falls back to defaults field by field, never throws
- Storage blocked (private mode / quota) → `saveDemoPreferences()` returns `false`; the form shows a warning toast rather than a false success
- SSR / no `window` → defaults, no throw

## Demo vs real — the design rule
The page is a **showcase**, so it deliberately keeps illustrative controls, but
it must never let a demo control *look* real:

- A banner at the top states plainly that only Theme is wired up, and that the
  Profile / notification / quota / default-view fields are placeholders that
  save to the browser but drive no behaviour.
- Every demo field's description says "Demo field."
- The save toast distinguishes the real theme change from the locally-stored
  demo values, and never claims a save that did not happen.

This is the fix for the original defect: the same fields used to persist nothing
and toast "Settings saved", i.e. the app reported success for behaviour that
could never happen, with no hint the controls were inert. Keep the showcase, but
keep it honest. When you make one of these real, wire it to its backing surface
(a mailer, a quota banner, an activity log / share link, real List and Grid
views plus a switcher) and drop the "Demo field" wording in the same change.

## UX States
- Loading: the form shows defaults for one frame, then resets to the live theme + stored demo values
- Saved: success toast (theme applied + demo values stored locally)
- Storage blocked: warning toast (theme applied, demo values not persisted)
- Invalid: inline field errors (e.g. display name < 2 chars, quota threshold outside 50–95)

## Verification
- Test files: `apps/web/src/lib/theme-preference.test.ts`, `apps/web/src/lib/demo-preferences.test.ts`
- Required cases: the offered theme set is exactly what `setTheme()` accepts and unknown values fall back to `system`; demo preferences round-trip through localStorage, fall back field-by-field on a partial/corrupt blob, and report `false` when storage is unavailable
- Focused verify command: `pnpm test:web`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when the E2E/live prerequisites in [Dev Workflows](../dev-workflows.md#commands) are available
- Pass criteria: focused tests and `pnpm verify` green; saving theme = dark leaves `html.class="dark"` and survives a reload; the demo banner is present and every demo field is labelled as such

## Related Docs
- [App Workflows](../app-workflows.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
