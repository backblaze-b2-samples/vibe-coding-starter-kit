import { spawnSync } from "node:child_process";

export const REQUIRED_PYTHON_MINOR = 11;

const PYTHON_CANDIDATES = [
  "python3",
  "python3.13",
  "python3.12",
  "python3.11",
  "python",
];

export function parseSemver(s) {
  const match = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: +match[1], minor: +match[2], patch: +match[3] };
}

function readVersion(bin) {
  const result = spawnSync(bin, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) return null;

  const text = `${result.stdout ?? ""} ${result.stderr ?? ""}`.trim();
  if (!text) return null;

  return { bin, text, version: parseSemver(text) };
}

export function findPython() {
  const found = [];

  for (const bin of PYTHON_CANDIDATES) {
    const candidate = readVersion(bin);
    if (!candidate) continue;
    found.push(candidate);

    const { version } = candidate;
    if (version && version.major >= 3 && version.minor >= REQUIRED_PYTHON_MINOR) {
      return { python: candidate, found };
    }
  }

  return { python: null, found };
}
