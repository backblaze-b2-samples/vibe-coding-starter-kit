import { describe, expect, it } from "vitest";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

import {
  MAX_AUTO_EXPAND_DEPTH,
  buildFileTree,
  initialExpandedPaths,
  type TreeFile,
  type TreeFolder,
} from "./file-tree";

function file(key: string, uploadedAt: string): FileMetadata {
  return {
    key,
    filename: key.split("/").pop() ?? key,
    folder: "",
    size_bytes: 1,
    size_human: "1 B",
    content_type: "text/plain",
    uploaded_at: uploadedAt,
    url: null,
  };
}

describe("buildFileTree", () => {
  it("nests files under folders derived from their keys", () => {
    const tree = buildFileTree([
      file("uploads/a.txt", "2026-02-01T00:00:00Z"),
      file("uploads/photos/b.png", "2026-02-02T00:00:00Z"),
      file("docs/c.pdf", "2026-02-03T00:00:00Z"),
    ]);

    // Two top-level folders, sorted alphabetically.
    expect(tree.map((n) => n.type)).toEqual(["folder", "folder"]);
    expect((tree[0] as TreeFolder).name).toBe("docs");
    expect((tree[1] as TreeFolder).name).toBe("uploads");

    // uploads/ contains a nested photos/ folder.
    const uploads = tree[1] as TreeFolder;
    expect((uploads.children[0] as TreeFolder).name).toBe("photos");
  });

  it("sorts files newest-first within a folder", () => {
    const tree = buildFileTree([
      file("uploads/old.txt", "2026-01-01T00:00:00Z"),
      file("uploads/new.txt", "2026-03-01T00:00:00Z"),
    ]);

    const uploads = tree[0] as TreeFolder;
    const names = uploads.children
      .filter((c): c is TreeFile => c.type === "file")
      .map((f) => f.name);
    expect(names).toEqual(["new.txt", "old.txt"]);
  });

  it("orders folders before files at the same level", () => {
    const tree = buildFileTree([
      file("root-file.txt", "2026-02-01T00:00:00Z"),
      file("zzz-folder/inner.txt", "2026-02-02T00:00:00Z"),
    ]);

    expect(tree[0].type).toBe("folder");
    expect(tree[1].type).toBe("file");
  });
});

describe("initialExpandedPaths", () => {
  it("expands only the top level when it already reveals files", () => {
    const tree = buildFileTree([
      file("uploads/a.txt", "2026-02-01T00:00:00Z"),
      file("uploads/photos/b.png", "2026-02-02T00:00:00Z"),
    ]);

    expect(initialExpandedPaths(tree)).toEqual(new Set(["uploads/"]));
  });

  it("keeps descending until file rows are visible", () => {
    // The reported case: every recent object lives two folders deep, so
    // expanding just the top level showed folder rows and zero files.
    const tree = buildFileTree([
      file("frames/346452a1b1e6/frame-000122.png", "2026-02-01T00:00:00Z"),
      file("renders/346452a1b1e6/out.mp4", "2026-02-02T00:00:00Z"),
    ]);

    expect(initialExpandedPaths(tree)).toEqual(
      new Set([
        "frames/",
        "frames/346452a1b1e6/",
        "renders/",
        "renders/346452a1b1e6/",
      ]),
    );
  });

  it("stops at the first level that reveals a file", () => {
    const tree = buildFileTree([
      file("a/b/shallow.txt", "2026-02-01T00:00:00Z"),
      file("a/b/c/d/deep.txt", "2026-02-02T00:00:00Z"),
    ]);

    // a/ then a/b/ reveals shallow.txt — c/ and d/ stay collapsed.
    expect(initialExpandedPaths(tree)).toEqual(new Set(["a/", "a/b/"]));
  });

  it("keeps descending when one stray file would otherwise satisfy it", () => {
    // The reported regression: a single top-level object was enough to stop the
    // descent, so `/files` said "Showing the 100 most recent" with ONE row on
    // screen and the other 99 sealed inside two collapsed folders.
    const tree = buildFileTree([
      file("3f2d22d9e916.json", "2026-02-03T00:00:00Z"),
      ...Array.from({ length: 97 }, (_, i) =>
        file(`frames/3f2d22d9e916/frame-${i}.png`, "2026-02-01T00:00:00Z"),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        file(`renders/3f2d22d9e916/out-${i}.mp4`, "2026-02-02T00:00:00Z"),
      ),
    ]);

    expect(initialExpandedPaths(tree)).toEqual(
      new Set([
        "frames/",
        "frames/3f2d22d9e916/",
        "renders/",
        "renders/3f2d22d9e916/",
      ]),
    );
  });

  it("expands top-level files-only listings to nothing", () => {
    const tree = buildFileTree([file("loose.txt", "2026-02-01T00:00:00Z")]);

    expect(initialExpandedPaths(tree)).toEqual(new Set());
  });

  it("is a no-op for an empty tree", () => {
    expect(initialExpandedPaths([])).toEqual(new Set());
  });

  it("never expands deeper than the depth cap", () => {
    const deepKey = `${Array.from({ length: 20 }, (_, i) => `d${i}`).join("/")}/f.txt`;
    const tree = buildFileTree([file(deepKey, "2026-02-01T00:00:00Z")]);

    expect(initialExpandedPaths(tree).size).toBe(MAX_AUTO_EXPAND_DEPTH);
  });
});
