"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileIcon,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { FileMetadataPanel } from "@/components/files/file-metadata-panel";
import { humanizeBytes } from "@/lib/utils";
import type {
  FileMetadataDetail,
  FileStatus,
} from "@vibe-coding-starter-kit/shared";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  error?: string;
  retryable?: boolean;
  metadata?: FileMetadataDetail | null;
}

interface UploadProgressProps {
  disabled?: boolean;
  items: UploadItem[];
  onRetry?: (id: string) => void;
}

function StatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case "uploading":
      return (
        <Loader2
          className="h-4 w-4 animate-spin text-primary"
          aria-hidden="true"
        />
      );
    case "complete":
      return (
        <CheckCircle2
          className="h-4 w-4 text-[var(--success)]"
          aria-hidden="true"
        />
      );
    case "error":
      return (
        <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
      );
  }
}

function getStatusLabel(item: UploadItem) {
  switch (item.status) {
    case "uploading":
      return `Uploading ${item.progress}%`;
    case "complete":
      return "Uploaded";
    case "error":
      return item.retryable === false ? "Cannot upload" : "Upload failed";
  }
}

function UploadRow({
  item,
  disabled,
  onRetry,
}: {
  item: UploadItem;
  disabled?: boolean;
  onRetry?: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const metadata = item.status === "complete" ? item.metadata : null;

  return (
    <div
      className="flex min-w-0 items-start gap-3 rounded-md border border-border bg-card p-3 animate-fade-in-up transition-colors hover:border-foreground/20 sm:items-center"
      role="listitem"
    >
      <FileIcon
        className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground sm:mt-0"
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p
              className="text-sm font-medium [overflow-wrap:anywhere] sm:truncate"
              title={item.file.name}
            >
              {item.file.name}
            </p>
            {item.error && (
              <p
                className="mt-1 text-xs text-destructive [overflow-wrap:anywhere]"
                aria-live="polite"
              >
                {item.error}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {humanizeBytes(item.file.size)}
            </span>
            <StatusIcon status={item.status} />
            <span className="text-xs text-muted-foreground">
              {getStatusLabel(item)}
            </span>
            {item.status === "error" &&
              item.retryable !== false &&
              onRetry && (
                <Button
                  aria-label={`Retry upload for ${item.file.name}`}
                  className="h-8 gap-1.5 px-2"
                  disabled={disabled}
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry?.(item.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </Button>
              )}
          </div>
        </div>
        {item.status === "uploading" && (
          <Progress
            aria-label={`Upload progress for ${item.file.name}`}
            value={item.progress}
            className="mt-2 h-1 progress-gradient"
          />
        )}
        {metadata && (
          <Collapsible
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            className="mt-2"
          >
            <CollapsibleTrigger asChild>
              <Button
                aria-label={`Toggle extracted metadata for ${item.file.name}`}
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                size="sm"
                variant="ghost"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    detailsOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
                {detailsOpen ? "Hide details" : "View details"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <FileMetadataPanel metadata={metadata} />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

export function UploadProgress({
  disabled,
  items,
  onRetry,
}: UploadProgressProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3" role="list" aria-label="Upload queue">
      {items.map((item) => (
        <UploadRow
          key={item.id}
          item={item}
          disabled={disabled}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
