"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dropzone } from "./dropzone";
import { UploadProgress } from "./upload-progress";
import { useUploadQueue } from "@/lib/upload-queue-context";
import { uploadQueueSummary } from "@/lib/upload-status";

/**
 * Thin view over the app-wide queue in `UploadQueueProvider`.
 *
 * The queue deliberately does NOT live here: component-local state was lost the
 * moment the user navigated away, which hid in-flight uploads and disarmed the
 * duplicate-upload guard.
 */
export function UploadForm() {
  const {
    addFiles,
    addRejections,
    clearCompleted,
    items,
    retry,
    uploading,
  } = useUploadQueue();

  const hasCompleted = items.some(
    (i) => i.status === "complete" || i.status === "error",
  );
  const summary = uploadQueueSummary(items);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Upload Files</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <Dropzone
          onFilesSelected={addFiles}
          onFilesRejected={addRejections}
          disabled={uploading}
        />
        {summary && (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">Upload queue</p>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {summary}
            </p>
          </div>
        )}
        <UploadProgress disabled={uploading} items={items} onRetry={retry} />
        {hasCompleted && !uploading && (
          <div className="flex justify-end">
            <Button
              aria-label="Clear completed and failed uploads"
              variant="outline"
              size="sm"
              onClick={clearCompleted}
            >
              Clear finished
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
