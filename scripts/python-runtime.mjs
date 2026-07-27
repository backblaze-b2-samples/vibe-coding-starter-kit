// Finds a usable Python interpreter for scripts/doctor.mjs and scripts/setup.mjs.
import { spawnSync } from "node:child_process";

import { parseSemver } from "./semver.mjs";

export const REQUIRED_PYTHON_MINOR = 11;

// python3 first (canonical on macOS/Linux), then the versioned names Homebrew
// installs, then the bare python shim (pyenv). The first candidate that meets
// the minimum wins — otherwise macOS reports a false failure on the system 3.9
// that `python3` points at, even with a newer Homebrew Python on PATH.
const PYTHON_CANDIDATES = [
  "python3",
  "python3.13",
  "python3.12",
  "python3.11",
  "python",
];

/**
 * @returns {{bin: string, text: string, version: object}|null} null when the
 * binary is absent, exits non-zero, or prints no recognizable version. A broken
 * shim (the macOS `xcode-select` stub, `pyenv` with no version set) writes noise
 * to stderr and exits non-zero; treating that noise as a version made the caller
 * report "<noise> is too old" instead of "Python is not on PATH".
 */
function readVersion(bin) {
  const result = spawnSync(bin, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) return null;

  // Python 2 prints --version to stderr, Python 3 to stdout.
  const text = `${result.stdout ?? ""} ${result.stderr ?? ""}`.trim();
  const version = text ? parseSemver(text) : null;
  if (!version) return null;

  return { bin, text, version };
}

export function findPython() {
  const found = [];

  for (const bin of PYTHON_CANDIDATES) {
    const candidate = readVersion(bin);
    if (!candidate) continue;
    found.push(candidate);

    const { version } = candidate;
    if (version.major >= 3 && version.minor >= REQUIRED_PYTHON_MINOR) {
      return { python: candidate, found };
    }
  }

  return { python: null, found };
}
