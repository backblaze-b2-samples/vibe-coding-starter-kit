import { describe, expect, it } from "vitest";
import {
  activeUploadLabel,
  interruptedUploadMessage,
  isServerPhase,
  SERVER_PHASE_LABEL,
  uploadQueueSummary,
  uploadStatusLabel,
} from "@/lib/upload-status";

describe("uploadStatusLabel", () => {
  it("reports byte progress while bytes are still moving", () => {
    expect(uploadStatusLabel({ status: "uploading", progress: 0 })).toBe(
      "Uploading 0%",
    );
    expect(uploadStatusLabel({ status: "uploading", progress: 28 })).toBe(
      "Uploading 28%",
    );
  });

  it("names the server-side phase instead of parking on 100%", () => {
    expect(uploadStatusLabel({ status: "uploading", progress: 100 })).toBe(
      SERVER_PHASE_LABEL,
    );
    expect(SERVER_PHASE_LABEL).not.toContain("100");
  });

  it("labels finished and failed rows", () => {
    expect(uploadStatusLabel({ status: "complete", progress: 100 })).toBe(
      "Uploaded",
    );
    expect(uploadStatusLabel({ status: "error", progress: 40 })).toBe(
      "Upload failed",
    );
    expect(
      uploadStatusLabel({ status: "error", progress: 0, retryable: false }),
    ).toBe("Cannot upload");
  });
});

describe("isServerPhase", () => {
  it("is true only for an in-flight upload with all bytes sent", () => {
    expect(isServerPhase({ status: "uploading", progress: 100 })).toBe(true);
    expect(isServerPhase({ status: "uploading", progress: 99 })).toBe(false);
    expect(isServerPhase({ status: "complete", progress: 100 })).toBe(false);
    expect(isServerPhase({ status: "error", progress: 100 })).toBe(false);
  });
});

describe("uploadQueueSummary", () => {
  it("is empty for an empty queue", () => {
    expect(uploadQueueSummary([])).toBe("");
  });

  it("prioritises in-flight uploads", () => {
    expect(
      uploadQueueSummary([{ status: "uploading" }, { status: "complete" }]),
    ).toContain("1 file uploading");
  });

  it("summarises mixed results", () => {
    const summary = uploadQueueSummary([
      { status: "complete" },
      { status: "error" },
      { status: "error" },
    ]);
    expect(summary).toContain("1 file uploaded");
    expect(summary).toContain("2 files need attention");
  });
});

describe("activeUploadLabel", () => {
  it("is null when nothing is uploading", () => {
    expect(activeUploadLabel([])).toBeNull();
    expect(activeUploadLabel([{ status: "complete" }])).toBeNull();
  });

  it("counts in-flight uploads for the app-wide indicator", () => {
    expect(activeUploadLabel([{ status: "uploading" }])).toBe(
      "Uploading 1 file",
    );
    expect(
      activeUploadLabel([{ status: "uploading" }, { status: "uploading" }]),
    ).toBe("Uploading 2 files");
  });
});

describe("interruptedUploadMessage", () => {
  it("is null when nothing was in flight", () => {
    expect(interruptedUploadMessage([])).toBeNull();
    expect(interruptedUploadMessage(["  "])).toBeNull();
  });

  it("names a single interrupted file", () => {
    const message = interruptedUploadMessage(["photo.jpg"]);
    expect(message).toContain("photo.jpg");
    expect(message).toContain("didn't finish");
  });

  it("caps the names it lists", () => {
    const message = interruptedUploadMessage(["a.jpg", "b.jpg", "c.jpg"]);
    expect(message).toContain("a.jpg, b.jpg");
    expect(message).toContain("1 more");
    expect(message).not.toContain("c.jpg");
  });
});
