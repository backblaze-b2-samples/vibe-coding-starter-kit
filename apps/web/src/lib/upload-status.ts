import type {
  FileMetadataDetail,
  FileStatus,
} from "@vibe-coding-starter-kit/shared";

/** One row of the upload queue. Owned by `UploadQueueProvider`. */
export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  error?: string;
  retryable?: boolean;
  metadata?: FileMetadataDetail | null;
}

/**
 * Shown once the browser has sent every byte to B2 but the API's verify step
 * hasn't answered yet.
 *
 * The determinate bar only tracks the browser -> B2 upload leg. Once that hits
 * 100%, the API still has to HEAD the object and sniff its leading bytes; a
 * full bar reading "Uploading 100%" during that wait looks finished-but-stuck.
 * Naming the phase makes the wait legible.
 */
export const SERVER_PHASE_LABEL = "Verifying upload...";

/** True while the upload is in its unnamed server-side phase. */
export function isServerPhase(item: Pick<UploadItem, "progress" | "status">) {
  return item.status === "uploading" && item.progress >= 100;
}

export function uploadStatusLabel(
  item: Pick<UploadItem, "progress" | "retryable" | "status">,
): string {
  switch (item.status) {
    case "uploading":
      return isServerPhase(item)
        ? SERVER_PHASE_LABEL
        : `Uploading ${item.progress}%`;
    case "complete":
      return "Uploaded";
    case "error":
      return item.retryable === false ? "Cannot upload" : "Upload failed";
  }
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** One-line status for the whole queue, or "" when there is nothing to say. */
export function uploadQueueSummary(
  items: Pick<UploadItem, "status">[],
): string {
  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  const completeCount = items.filter((i) => i.status === "complete").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  if (uploadingCount > 0) {
    const label = formatCount(uploadingCount, "file");
    return `${label} uploading. New files can be added when this queue finishes.`;
  }

  if (errorCount > 0 && completeCount > 0) {
    const completeLabel = formatCount(completeCount, "file");
    const errorLabel = formatCount(errorCount, "file");
    return `${completeLabel} uploaded. ${errorLabel} need attention.`;
  }

  if (errorCount > 0) {
    return `${formatCount(errorCount, "file")} need attention.`;
  }

  if (completeCount > 0) {
    return `${formatCount(completeCount, "file")} uploaded.`;
  }

  return "";
}

/** Compact label for the app-wide in-progress indicator. */
export function activeUploadLabel(
  items: Pick<UploadItem, "status">[],
): string | null {
  const uploadingCount = items.filter((i) => i.status === "uploading").length;
  if (uploadingCount === 0) return null;
  return `Uploading ${formatCount(uploadingCount, "file")}`;
}

const MAX_NAMED_INTERRUPTED = 2;

/**
 * Copy for "your upload didn't finish" after a reload/navigation killed it.
 *
 * A reload mid-upload aborts the XHR and the page comes back with an empty
 * queue and no explanation, so the file silently never arrived.
 */
export function interruptedUploadMessage(names: string[]): string | null {
  const named = names.filter((n) => n.trim().length > 0);
  if (named.length === 0) return null;

  if (named.length === 1) {
    return `${named[0]} didn't finish uploading — the page was reloaded or closed. Upload it again.`;
  }

  const head = named.slice(0, MAX_NAMED_INTERRUPTED).join(", ");
  const rest = named.length - MAX_NAMED_INTERRUPTED;
  const subject = rest > 0 ? `${head} and ${rest} more` : head;
  return `${subject} didn't finish uploading — the page was reloaded or closed. Upload them again.`;
}
