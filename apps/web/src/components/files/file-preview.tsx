"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileMetadataPanel } from "./file-metadata-panel";
import { getDownloadUrl } from "@/lib/api-client";
import type { FileMetadata, FileMetadataDetail } from "@vibe-coding-starter-kit/shared";

interface FilePreviewProps {
  file: FileMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreview({ file, open, onOpenChange }: FilePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null);
      return;
    }
    setLoading(true);
    getDownloadUrl(file.key)
      .then(({ url }) => setPreviewUrl(url))
      .catch(() => setPreviewUrl(file.url))
      .finally(() => setLoading(false));
  }, [file, open]);

  if (!file) return null;

  const isImage = file.content_type.startsWith("image/");
  const isPdf = file.content_type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">{file.filename}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-center rounded-lg border bg-muted/30 min-h-[200px]">
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt={file.filename}
                className="max-h-[400px] object-contain rounded"
              />
            ) : isPdf && previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[400px] rounded"
                title={file.filename}
              />
            ) : (
              <div className="text-center text-muted-foreground p-8">
                <p className="text-sm">Preview not available</p>
                <p className="text-xs mt-1">{file.content_type}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span>{file.size_human}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{file.content_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded</span>
                <span>
                  {new Date(file.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Key</span>
                <span className="font-mono text-xs truncate max-w-[200px]">
                  {file.key}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
