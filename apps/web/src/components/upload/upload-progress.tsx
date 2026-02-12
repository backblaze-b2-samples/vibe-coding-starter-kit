"use client";

import { FileIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { FileStatus } from "@oss-starter-kit/shared";

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: FileStatus;
  error?: string;
}

interface UploadProgressProps {
  items: UploadItem[];
}

function humanizeBytes(bytes: number) {
  for (const unit of ["B", "KB", "MB", "GB"]) {
    if (Math.abs(bytes) < 1024) return `${bytes.toFixed(1)} ${unit}`;
    bytes /= 1024;
  }
  return `${bytes.toFixed(1)} TB`;
}

function StatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case "uploading":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
  }
}

export function UploadProgress({ items }: UploadProgressProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <FileIcon className="h-8 w-8 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{item.file.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {humanizeBytes(item.file.size)}
                </span>
                <StatusIcon status={item.status} />
              </div>
            </div>
            {item.status === "uploading" && (
              <Progress value={item.progress} className="mt-2 h-1.5" />
            )}
            {item.error && (
              <p className="text-xs text-destructive mt-1">{item.error}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
