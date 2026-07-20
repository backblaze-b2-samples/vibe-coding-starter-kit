"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileMetadataPanel } from "@/components/files/file-metadata-panel";
import { useFileDetail, usePreviewUrl } from "@/lib/queries";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

interface FilePreviewProps {
  file: FileMetadata | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PreviewMetaRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`min-w-0 break-all text-right ${
          mono ? "font-mono text-xs tabular-nums" : ""
        }`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function formatPreviewDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function FilePreview({ file, open, onOpenChange }: FilePreviewProps) {
  // Fetch a presigned preview URL only while the dialog is open. Falls
  // back to the file's stored URL if the API call fails (e.g. the
  // `/preview` endpoint is unreachable but we still have a static URL).
  const { data, isLoading, isError, error } = usePreviewUrl(
    file?.key,
    open && !!file,
  );
  const previewUrl = data?.url ?? file?.url ?? null;

  const [detailsOpen, setDetailsOpen] = useState(false);

  // Collapse the disclosure when the dialog closes, so reopening (possibly for
  // a different file) starts collapsed and doesn't auto-trigger the heavier
  // detail fetch. Done in the close handler rather than an effect to avoid a
  // cascading setState-in-effect render.
  function handleOpenChange(next: boolean) {
    if (!next) setDetailsOpen(false);
    onOpenChange(next);
  }

  // Rich metadata is recomputed server-side (a full object download), so fetch
  // it lazily: only once the dialog is open AND the user expands the details.
  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
  } = useFileDetail(file?.key, open && detailsOpen);

  if (!file) return null;

  const isImage = file.content_type.startsWith("image/");
  const isPdf = file.content_type === "application/pdf";
  const previewError =
    isError && error instanceof Error
      ? error.message
      : "The preview link could not be created.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85svh] w-[calc(100vw-2rem)] sm:max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="min-w-0 break-words pr-6">
            {file.filename}
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="flex min-w-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 min-h-[220px]">
            {isLoading ? (
              <div
                className="w-full p-3"
                role="status"
                aria-live="polite"
                aria-label="Loading file preview"
              >
                <p className="sr-only">Loading file preview...</p>
                <Skeleton className="h-[min(55svh,400px)] min-h-[220px] w-full" />
              </div>
            ) : isImage && previewUrl ? (
              <div className="relative h-[min(55svh,400px)] min-h-[220px] w-full">
                {/* `unoptimized` because presigned URLs carry their own
                    short-lived expiry and we don't want Next's image
                    optimizer caching them past that window. */}
                <Image
                  src={previewUrl}
                  alt={file.filename}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-contain rounded"
                  unoptimized
                />
              </div>
            ) : isPdf && previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-[min(55svh,400px)] min-h-[220px] w-full rounded"
                title={`Preview of ${file.filename}`}
              />
            ) : (
              <div className="max-w-sm p-8 text-center text-muted-foreground">
                <p className="text-sm font-medium text-foreground">
                  {isError ? "Preview URL unavailable" : "Preview not available"}
                </p>
                <p className="mt-1 text-xs break-words">
                  {isError ? previewError : file.content_type}
                </p>
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-2 text-sm">
            <PreviewMetaRow label="Size" value={file.size_human} mono />
            <PreviewMetaRow label="Type" value={file.content_type} />
            <PreviewMetaRow
              label="Uploaded"
              value={formatPreviewDate(file.uploaded_at)}
            />
            <PreviewMetaRow label="Key" value={file.key} mono />
          </div>
        </div>
        {/* Detailed metadata spans the full dialog width rather than the
            right half-column, so long checksums / EXIF / PDF rows have room
            to breathe instead of wrapping inside a cramped box. */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              aria-label={`Toggle detailed metadata for ${file.filename}`}
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
              {detailsOpen ? "Hide details" : "Detailed metadata"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {detailLoading ? (
              <Skeleton
                className="h-40 w-full"
                role="status"
                aria-label="Loading detailed metadata"
              />
            ) : detailError ? (
              <p className="text-xs text-destructive" aria-live="polite">
                Couldn&apos;t load detailed metadata. It&apos;s recomputed by
                downloading the file — try again, or check the API logs.
              </p>
            ) : detail ? (
              <FileMetadataPanel metadata={detail} />
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </DialogContent>
    </Dialog>
  );
}
