// Shared local-bind probe for scripts/doctor.mjs and scripts/pick-port.mjs.
//
// Four outcomes, and callers must keep them apart:
//   free        — nothing is listening and we were allowed to bind
//   busy        — EADDRINUSE: something already owns the port
//   denied      — EACCES/EPERM: a sandbox forbids listening at all
//   unsupported — the address family does not exist on this host (a `::`/`::1`
//                 probe inside an IPv6-disabled container), which is neither a
//                 busy port nor a fault worth stopping for
import { createServer } from "node:net";

const BIND_DENIED_CODES = new Set(["EACCES", "EPERM"]);

// IPv6 is commonly absent in containers and CI sandboxes. Reporting these as
// errors would fail `pnpm run doctor` (and therefore `pnpm dev` via predev) on a
// host where the IPv4 bind — the one that actually matters — is fine.
const BIND_UNSUPPORTED_CODES = new Set([
  "EAFNOSUPPORT",
  "EADDRNOTAVAIL",
  "EPROTONOSUPPORT",
]);

/** One copy of the sandbox advice, so doctor and pick-port cannot drift. */
export const BIND_DENIED_FIX =
  "Allow localhost server binding in your sandbox, or run dev/E2E in an environment that permits local servers";

export function formatBindDiagnostic(result) {
  const host = result.host.includes(":") ? `[${result.host}]` : result.host;
  const code = result.code ? ` (${result.code})` : "";
  const message = result.message ? `: ${result.message}` : "";
  return `${host}:${result.port}${code}${message}`;
}

export function probeBind(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ host, port, ...result });
    };

    const fail = (error) => {
      const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
      if (code === "EADDRINUSE") {
        finish({ status: "busy", code });
      } else if (BIND_DENIED_CODES.has(code)) {
        finish({ status: "denied", code, message: error.message });
      } else if (BIND_UNSUPPORTED_CODES.has(code)) {
        finish({ status: "unsupported", code, message: error.message });
      } else {
        finish({ status: "error", code, message: error?.message });
      }
    };

    server.once("error", fail);
    server.once("listening", () => server.close(() => finish({ status: "free" })));

    try {
      server.listen(port, host);
    } catch (error) {
      fail(error);
    }
  });
}
