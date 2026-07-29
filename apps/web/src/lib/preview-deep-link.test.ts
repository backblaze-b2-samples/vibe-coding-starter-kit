import { describe, expect, it } from "vitest";

import {
  PREVIEW_PARAM,
  ancestorPaths,
  previewHref,
  takePreviewKeyFromUrl,
} from "./preview-deep-link";

describe("previewHref", () => {
  it("points at the files page with the key as the preview param", () => {
    expect(previewHref("uploads/photo.jpg")).toBe(
      `/files?${PREVIEW_PARAM}=uploads%2Fphoto.jpg`,
    );
  });

  it("encodes characters that would otherwise break the query string", () => {
    expect(previewHref("uploads/a b&c=d?e.png")).toBe(
      `/files?${PREVIEW_PARAM}=uploads%2Fa%20b%26c%3Dd%3Fe.png`,
    );
  });
});

describe("ancestorPaths", () => {
  it("lists each containing folder outermost first, with trailing slashes", () => {
    // Trailing slashes match `TreeFolder.path` from buildFileTree, which is what
    // the browser's `expanded` set is keyed on.
    expect(ancestorPaths("frames/3f2d22d9e916/frame-000122.png")).toEqual([
      "frames/",
      "frames/3f2d22d9e916/",
    ]);
  });

  it("returns nothing for a top-level key", () => {
    expect(ancestorPaths("loose.txt")).toEqual([]);
  });

  it("handles a single folder", () => {
    expect(ancestorPaths("uploads/photo.jpg")).toEqual(["uploads/"]);
  });
});

describe("takePreviewKeyFromUrl", () => {
  it("is null without a DOM, so the server render never touches it", () => {
    // Unit tests run in vitest's default node environment: no `window`. The
    // browser-side consume-and-clear path is exercised through the UI, not here.
    expect(takePreviewKeyFromUrl()).toBeNull();
  });
});
