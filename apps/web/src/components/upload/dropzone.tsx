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
      className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        {isDragActive ? (
          <>
            <FileIcon className="h-10 w-10 text-primary" />
            <p className="text-lg font-medium">Drop files here</p>
          </>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-lg font-medium">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Max file size: 100MB
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
