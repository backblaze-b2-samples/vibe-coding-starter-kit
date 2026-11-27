import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getVerifyRun, getVerifyRuns } from "./api-client";
import { qk } from "./queries";

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function requestedPath() {
  const [input] = fetchMock.mock.calls[0];
  const url = new URL(input as string);
  return `${url.pathname}${url.search}`;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse([]));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verification run client", () => {
  it("lists runs from the contract path", async () => {
    await getVerifyRuns();
    expect(requestedPath()).toBe("/verify/runs");
  });

  it("fetches one run by id", async () => {
    await getVerifyRun("2026-05-28--abc12345");
    expect(requestedPath()).toBe("/verify/runs/2026-05-28--abc12345");
  });

  it("percent-encodes the id so it cannot add path segments", async () => {
    await getVerifyRun("../files");
    expect(requestedPath()).toBe("/verify/runs/..%2Ffiles");
  });

  it("keys the run list under the generated query-key root", () => {
    expect(qk.verifyRuns()).toEqual(["b2", "verify", "runs"]);
  });
});
