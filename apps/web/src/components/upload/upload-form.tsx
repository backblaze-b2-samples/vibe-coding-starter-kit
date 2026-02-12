"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { FileRejection } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dropzone } from "./dropzone";
import { UploadProgress, type UploadItem } from "./upload-progress";
import { uploadFile } from "@/lib/api-client";

function humanizeBytes(bytes: number) {
  for (const unit of ["B", "KB", "MB", "GB"]) {
    if (Math.abs(bytes) < 1024) return `${bytes.toFixed(1)} ${unit}`;
    bytes /= 1024;
  }
  return `${bytes.toFixed(1)} TB`;
}

export function UploadForm() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFilesRejected = useCallback((rejections: FileRejection[]) => {
    for (const rejection of rejections) {
      const name = rejection.file.name;
      const errors = rejection.errors.map((e) => {
        if (e.code === "file-too-large") {
          return `exceeds 100MB limit (${humanizeBytes(rejection.file.size)})`;
        }
        return e.message;
      });
      toast.error(`${name}: ${errors.join(", ")}`);
    }
  }, []);

  const handleFilesSelected = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: "uploading" as const,
    }));
    setItems((prev) => [...prev, ...newItems]);
    setUploading(true);

    const uploadQueue = async () => {
      for (const item of newItems) {
        try {
          await uploadFile(item.file, (percent) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, progress: percent } : i
              )
            );
          });
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "complete", progress: 100 }
                : i
            )
          );
          toast.success(`${item.file.name} uploaded successfully`);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Upload failed";
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: "error", error: message }
                : i
            )
          );
          toast.error(`Failed to upload ${item.file.name}: ${message}`);
        }
      }
      setUploading(false);
    };

    uploadQueue();
  }, []);

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === "uploading"));
  }, []);

  const hasCompleted = items.some(
    (i) => i.status === "complete" || i.status === "error"
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Files</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dropzone
          onFilesSelected={handleFilesSelected}
          onFilesRejected={handleFilesRejected}
          disabled={uploading}
        />
        <UploadProgress items={items} />
        {hasCompleted && !uploading && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearCompleted}>
              Clear completed
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
