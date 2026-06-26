import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  deleteFile,
  getDownloadUrl,
  getFile,
  getPreviewUrl,
} from "./api-client";

type FileKeyOperation = {
  call: (key: string) => Promise<unknown>;
  method: "GET" | "DELETE";
  name: string;
  path: string;
};

const operations: FileKeyOperation[] = [
  {
    call: getFile,
    method: "GET",
    name: "getFile",
    path: "/files-by-key/metadata",
  },
  {
    call: getDownloadUrl,
    method: "GET",
    name: "getDownloadUrl",
    path: "/files-by-key/download",
  },
  {
    call: getPreviewUrl,
    method: "GET",
    name: "getPreviewUrl",
    path: "/files-by-key/preview",
  },
  {
    call: deleteFile,
    method: "DELETE",
    name: "deleteFile",
    path: "/files-by-key",
  },
];

const keyCases = [
  "folder/file.txt",
  "folder/file #1?.txt",
  "folder/100% complete.txt",
  "../secret.txt",
  "uploads/%2e%2e/secret.txt",
  "stats",
  "stats/activity",
  "tenant-a/reports/download",
  "tenant-a/reports/preview",
].map((key) => ({ key }));

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

async function expectEmptyKeyRejected(call: FileKeyOperation["call"]) {
  try {
    await call("");
    throw new Error("Expected empty key to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.message).toBe("File key is required");
    expect(apiError.status).toBe(400);
  }
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({}));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(operations)("$name", ({ call, method, path }) => {
  it.each(keyCases)("sends '$key' as a query parameter", async ({ key }) => {
    await call(key);

    expect(requestedPath()).toBe(`${path}?${new URLSearchParams({ key })}`);
    const init = fetchMock.mock.calls[0][1];
    expect(init?.method ?? "GET").toBe(method);
  });

  it("rejects empty keys before making a request", async () => {
    await expectEmptyKeyRejected(call);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
