"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getFiles } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { useRefresh } from "@/lib/refresh-context";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

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
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshKey } = useRefresh();

  useEffect(() => {
    setLoading(true);
    getFiles("", 10)
      .then(setFiles)
      .catch(() => {
        setFiles([]);
        toast.error("Failed to load recent uploads");
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Uploads</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No files uploaded yet. Go to Upload to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.key}>
                  <TableCell className="font-medium truncate max-w-[200px]">
                    {file.filename}
                  </TableCell>
                  <TableCell>{file.size_human}</TableCell>
                  <TableCell>{mimeToLabel(file.content_type)}</TableCell>
                  <TableCell>{formatDate(file.uploaded_at)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">Complete</Badge>
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
