import { createServer } from "node:net";

const BIND_DENIED_CODES = new Set(["EACCES", "EPERM"]);

export function isBindDeniedCode(code) {
  return BIND_DENIED_CODES.has(code);
}

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
      } else if (isBindDeniedCode(code)) {
        finish({ status: "denied", code, message: error.message });
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
