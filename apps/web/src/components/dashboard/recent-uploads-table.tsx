"use client";

import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { previewHref } from "@/lib/preview-deep-link";
import { useFiles } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

function mimeToLabel(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": "Image",
    "image/png": "Image",
    "image/gif": "Image",
    "image/webp": "Image",
    "application/pdf": "PDF",
    "text/plain": "Text",
    "text/csv": "CSV",
    "application/json": "JSON",
    "application/zip": "Archive",
    "video/mp4": "Video",
    "audio/mpeg": "Audio",
  };
  return map[mime] || "File";
}

export function RecentUploadsTable() {
  const { data: files = [], isLoading, error, refetch } = useFiles("", 10);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Recent Uploads</CardTitle>
        <CardAction className="self-center">
          <Link
            href="/files"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : files.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No uploads yet"
            description="Head to Upload to add your first files."
          />
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[34%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Filename
                </TableHead>
                <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Size
                </TableHead>
                <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="w-[22%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="w-[16%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.key} className="table-row-hover">
                  <TableCell className="font-medium">
                    {/* `/files` teaches "Click a file to preview it", so the
                        same gesture here was a reasonable first try — and did
                        nothing at all (inert text: no role, no tabindex, no
                        handler). A link to the file's preview makes the row
                        answer that gesture and reads as interactive. */}
                    <Link
                      href={previewHref(file.key)}
                      className="block truncate rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      title={`Preview ${file.filename}`}
                    >
                      {file.filename}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {file.size_human}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {mimeToLabel(file.content_type)}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {formatDate(file.uploaded_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                      Complete
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
