"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { FileMetadataDetail } from "@oss-starter-kit/shared";

interface FileMetadataPanelProps {
  metadata: FileMetadataDetail;
}

function MetaRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export function FileMetadataPanel({ metadata }: FileMetadataPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">File Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetaRow label="Filename" value={metadata.filename} />
        <MetaRow label="Size" value={metadata.size_human} />
        <MetaRow label="Type" value={metadata.mime_type} />
        <MetaRow label="Extension" value={metadata.extension || "none"} />

        <Separator />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Checksums
        </p>
        <MetaRow label="MD5" value={metadata.md5} />
        <MetaRow label="SHA-256" value={metadata.sha256} />

        {/* Image metadata */}
        {metadata.image_width && metadata.image_height && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Image
            </p>
            <MetaRow
              label="Dimensions"
              value={`${metadata.image_width} x ${metadata.image_height}`}
            />
            {metadata.exif && (
              <div className="space-y-1">
                {Object.entries(metadata.exif)
                  .slice(0, 8)
                  .map(([key, val]) => (
                    <MetaRow key={key} label={key} value={val} />
                  ))}
              </div>
            )}
          </>
        )}

        {/* PDF metadata */}
        {metadata.pdf_pages != null && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              PDF
            </p>
            <MetaRow label="Pages" value={metadata.pdf_pages} />
            {metadata.pdf_author && (
              <MetaRow label="Author" value={metadata.pdf_author} />
            )}
            {metadata.pdf_title && (
              <MetaRow label="Title" value={metadata.pdf_title} />
            )}
          </>
        )}

        {/* Audio/Video metadata */}
        {metadata.duration_seconds != null && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Media
            </p>
            <MetaRow
              label="Duration"
              value={`${metadata.duration_seconds.toFixed(1)}s`}
            />
            {metadata.codec && <MetaRow label="Codec" value={metadata.codec} />}
            {metadata.bitrate && (
              <MetaRow label="Bitrate" value={`${metadata.bitrate} bps`} />
            )}
          </>
        )}

        <Separator />
        <MetaRow
          label="Uploaded"
          value={new Date(metadata.uploaded_at).toLocaleString()}
        />
      </CardContent>
    </Card>
  );
}
