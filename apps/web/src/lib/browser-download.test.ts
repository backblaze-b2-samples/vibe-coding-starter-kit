import { describe, expect, it } from "vitest";

import { startBrowserDownload } from "./browser-download";

interface FakeAnchor {
  href: string;
  download: string;
  rel: string;
  style: { display: string };
  clicks: number;
  removed: boolean;
  click(): void;
  remove(): void;
}

function fakeDocument() {
  const anchor: FakeAnchor = {
    href: "",
    download: "",
    rel: "",
    style: { display: "" },
    clicks: 0,
    removed: false,
    click() {
      this.clicks += 1;
    },
    remove() {
      this.removed = true;
    },
  };
  const appended: FakeAnchor[] = [];
  const doc = {
    body: {
      appendChild(node: FakeAnchor) {
        appended.push(node);
      },
    },
    createElement: () => anchor,
  };
  return { anchor, appended, doc: doc as unknown as Document };
}

describe("startBrowserDownload", () => {
  it("clicks an anchor pointing at the presigned URL", () => {
    const { anchor, appended, doc } = fakeDocument();

    const started = startBrowserDownload("https://b2/signed", "photo.png", doc);

    expect(started).toBe(true);
    expect(anchor.href).toBe("https://b2/signed");
    expect(anchor.download).toBe("photo.png");
    expect(anchor.clicks).toBe(1);
    expect(appended).toEqual([anchor]);
  });

  it("cleans the anchor back out of the document", () => {
    const { anchor, doc } = fakeDocument();

    startBrowserDownload("https://b2/signed", "photo.png", doc);

    expect(anchor.removed).toBe(true);
  });

  it("works without a filename", () => {
    const { anchor, doc } = fakeDocument();

    expect(startBrowserDownload("https://b2/signed", undefined, doc)).toBe(true);
    expect(anchor.download).toBe("");
  });

  it("reports failure instead of pretending, with no DOM", () => {
    expect(startBrowserDownload("https://b2/signed", "a.png", undefined)).toBe(
      false,
    );
  });

  it("reports failure for an empty URL", () => {
    const { anchor, doc } = fakeDocument();

    expect(startBrowserDownload("", "a.png", doc)).toBe(false);
    expect(anchor.clicks).toBe(0);
  });
});
