import { describe, expect, it } from "vitest";

import { ACCEPTED_FILE_TYPES } from "./upload-file-types";

// Mirror of the backend `ALLOWED_TYPES` set in
// services/api/app/service/upload.py. The dropzone allow-list must stay in
// lockstep with what the server accepts; this fails loudly if either drifts.
const BACKEND_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "video/mp4",
  "audio/mpeg",
  "audio/wav",
  "text/markdown",
  "application/yaml",
  "application/x-yaml",
  "application/x-ndjson",
  "text/tab-separated-values",
  "application/xml",
  "text/xml",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/quicktime",
  "video/webm",
];

describe("ACCEPTED_FILE_TYPES", () => {
  it("covers exactly the backend allow-list", () => {
    expect(new Set(Object.keys(ACCEPTED_FILE_TYPES))).toEqual(
      new Set(BACKEND_ALLOWED_TYPES)
    );
  });

  it("maps every type to at least one dot-prefixed extension", () => {
    for (const exts of Object.values(ACCEPTED_FILE_TYPES)) {
      expect(exts.length).toBeGreaterThan(0);
      for (const ext of exts) {
        expect(ext.startsWith(".")).toBe(true);
      }
    }
  });
});
