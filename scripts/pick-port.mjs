#!/usr/bin/env node
// Probe loopbacks (not wildcards) because uvicorn binds 127.0.0.1 by
// default, and on macOS a 127.0.0.1 conflict doesn't show up via a
// 0.0.0.0 probe — the two don't overlap there.
//
// Usage:  node scripts/pick-port.mjs [start]   (default start=8000)

import { BIND_DENIED_FIX, formatBindDiagnostic, probeBind } from "./local-bind.mjs";

const RANGE = 10;
const LOOPBACKS = ["127.0.0.1", "::1"];
const start = Number.parseInt(process.argv[2] ?? "8000", 10);

async function isFree(port) {
  const results = await Promise.all(LOOPBACKS.map((h) => probeBind(port, h)));
  const denied = results.find((result) => result.status === "denied");
  const error = results.find((result) => result.status === "error");

  if (denied) {
    console.error(
      `pick-port: local bind permission denied while probing ${formatBindDiagnostic(denied)}\n` +
        `fix: ${BIND_DENIED_FIX}.`,
    );
    process.exit(2);
  }

  if (error) {
    console.error(`pick-port: could not probe ${formatBindDiagnostic(error)}`);
    process.exit(1);
  }

  // `unsupported` means the loopback family itself is missing (an IPv6-disabled
  // container answering the ::1 probe). That is not a reason to skip the port —
  // uvicorn will bind the family that does exist.
  return results.every(
    (result) => result.status === "free" || result.status === "unsupported",
  );
}

for (let p = start; p < start + RANGE; p++) {
  if (await isFree(p)) {
    process.stdout.write(String(p));
    process.exit(0);
  }
}

console.error(`pick-port: no free port in ${start}..${start + RANGE - 1}`);
process.exit(1);
