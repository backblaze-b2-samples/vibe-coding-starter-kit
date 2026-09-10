/** Lenient version parser shared by the Node, pnpm, and Python checks. */
export function parseSemver(s) {
  // Pulls "v20.10.0" / "20.10.0" / "9.15.0" / "Python 3.13.5" — lenient.
  const match = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3] };
}
