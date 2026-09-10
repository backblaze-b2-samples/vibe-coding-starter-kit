/**
 * Copy for a wait that can take seconds, and escalates when it does.
 *
 * A skeleton alone is a lie past a few seconds: `/files` and the dashboard both
 * need a full bucket listing, which measured 2.8s-21s on a 16k-object bucket.
 * The old UI put "Loading files..." in an `sr-only` paragraph, so a sighted user
 * saw six pulsing bars and nothing else — at 20s there was no way to tell "still
 * listing 16,000 objects" from "hung".
 *
 * Pure on purpose (a component owns the clock) so the thresholds and wording are
 * unit-testable.
 */

/** A wait longer than this stops being "instant" and gets an explanation. */
export const SLOW_LOAD_MS = 4_000;
/** A wait longer than this needs to say the number could be very large. */
export const VERY_SLOW_LOAD_MS = 12_000;

export type LoadingPhase = "starting" | "slow" | "very-slow";

export interface LoadingCopy {
  /** Always shown next to the spinner. Never empty. */
  message: string;
  /** Extra explanation once the wait is long enough to need one. */
  hint: string | null;
}

export function loadingPhase(elapsedMs: number): LoadingPhase {
  if (elapsedMs >= VERY_SLOW_LOAD_MS) return "very-slow";
  if (elapsedMs >= SLOW_LOAD_MS) return "slow";
  return "starting";
}

/**
 * Visible loading copy for `subject` (e.g. "files", "bucket stats").
 *
 * @param elapsedMs how long the wait has been running
 * @param subject   what is being loaded, lowercase, used mid-sentence
 */
export function loadingCopy(elapsedMs: number, subject: string): LoadingCopy {
  switch (loadingPhase(elapsedMs)) {
    case "very-slow":
      return {
        message: `Still loading ${subject}…`,
        hint: "This bucket holds a lot of objects, and listing all of them can take 20 seconds or more the first time. The result is cached, so the next load is fast.",
      };
    case "slow":
      return {
        message: `Still loading ${subject}…`,
        hint: "Listing every object in the bucket — this takes a few seconds on a large bucket.",
      };
    default:
      return { message: `Loading ${subject}…`, hint: null };
  }
}
