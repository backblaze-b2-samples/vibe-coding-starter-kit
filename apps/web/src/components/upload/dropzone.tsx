"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Upload, FileIcon } from "lucide-react";

interface DropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onFilesRejected: (rejections: FileRejection[]) => void;
  disabled?: boolean;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export function Dropzone({ onFilesSelected, onFilesRejected, disabled }: DropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        onFilesSelected(accepted);
      }
    },
    [onFilesSelected]
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      onFilesRejected(rejections);
    },
    [onFilesRejected]
  );

  const { getRootProps, getInputProps, isDragActive } =
    useDropzone({
      onDrop,
      onDropRejected,
      maxSize: MAX_SIZE,
      disabled,
      multiple: true,
    });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center rounded-md border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
        isDragActive
          ? "border-primary bg-[var(--accent-subtle)] dropzone-active"
          : "border-border hover:border-primary/60 hover:bg-muted/60"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {isDragActive ? (
          <>
            <div className="stat-icon-wrap !w-12 !h-12">
              <FileIcon className="h-5 w-5" />
            </div>
            <p className="text-base font-semibold">Drop files here</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted border border-border">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base font-semibold">
                Drag &amp; drop files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Max file size: 100 MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
