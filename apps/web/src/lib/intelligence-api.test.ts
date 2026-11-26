import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSnapshotActivity,
  getSnapshotClusters,
  getSnapshotIssues,
  getSnapshotReport,
  listSnapshots,
} from "./api-client";

const ID = "20260101T000000Z";
const fetchMock = vi.fn<typeof fetch>();

function requested() {
  const [input, init] = fetchMock.mock.calls[0];
  const url = new URL(input as string);
  return { target: `${url.pathname}${url.search}`, method: init?.method ?? "GET" };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(
    new Response("[]", { headers: { "Content-Type": "application/json" }, status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("intelligence client", () => {
  it.each([
    ["list", () => listSnapshots(), "/intelligence/snapshots"],
    ["report", () => getSnapshotReport(ID), `/intelligence/snapshots/${ID}`],
    ["clusters", () => getSnapshotClusters(ID), `/intelligence/snapshots/${ID}/clusters`],
    ["activity", () => getSnapshotActivity(ID), `/intelligence/snapshots/${ID}/activity`],
  ])("reads %s with a GET to the contract path", async (_name, call, path) => {
    await call();
    expect(requested()).toEqual({ target: path, method: "GET" });
  });

  it("sends only the filters that are set", async () => {
    await getSnapshotIssues(ID, { cluster_id: "c0", category: "", min_spec_depth: 0, limit: 25 });
    expect(requested().target).toBe(
      `/intelligence/snapshots/${ID}/issues?cluster_id=c0&min_spec_depth=0&limit=25`,
    );
  });

  it("percent-encodes the snapshot id so it cannot add path segments", async () => {
    await getSnapshotReport("../files");
    expect(requested().target).toBe("/intelligence/snapshots/..%2Ffiles");
  });

  it("never calls a trigger route: those are operator-only", async () => {
    await listSnapshots();
    expect(requested().method).toBe("GET");
  });
});
