import { describe, expect, it } from "vitest";
import {
  FILE_LIST_LIMIT,
  fileListTruncationNotice,
} from "@/lib/file-list-limit";

describe("fileListTruncationNotice", () => {
  it("stays silent when the list is not truncated", () => {
    expect(fileListTruncationNotice(12, 12)).toBeNull();
    expect(fileListTruncationNotice(0, 0)).toBeNull();
    expect(fileListTruncationNotice(99, 12808)).toBeNull();
  });

  it("names both counts when the bucket holds more than the page", () => {
    const notice = fileListTruncationNotice(100, 12808);
    expect(notice).toContain("100");
    expect(notice).toContain("12,808");
    expect(notice).not.toContain("everything");
  });

  it("still admits the cap when the bucket total is unknown", () => {
    const notice = fileListTruncationNotice(100, undefined);
    expect(notice).toContain("100 most recent");
  });

  it("does not claim a bigger total than it can prove", () => {
    // Stats can lag the list (30s cache) and report a smaller number.
    const notice = fileListTruncationNotice(100, 42);
    expect(notice).toBe(fileListTruncationNotice(100, undefined));
  });

  it("honours a non-default limit", () => {
    expect(fileListTruncationNotice(50, 500, 100)).toBeNull();
    expect(fileListTruncationNotice(50, 500, 50)).toContain("500");
  });

  it("matches the limit the API defaults to", () => {
    expect(FILE_LIST_LIMIT).toBe(100);
  });
});
