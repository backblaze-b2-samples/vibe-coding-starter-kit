"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOpen, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingNotice } from "@/components/common/loading-notice";
import { FilePreview } from "./file-preview";
import { FileTreeRow } from "./file-tree-row";
import { ApiError } from "@/lib/api-client";
import { startBrowserDownload } from "@/lib/browser-download";
import {
  useDeleteFile,
  useDownloadUrl,
  useFileStats,
  useFiles,
} from "@/lib/queries";
import { buildFileTree, initialExpandedPaths } from "@/lib/file-tree";
import {
  FILE_LIST_LIMIT,
  fileListTruncationNotice,
} from "@/lib/file-list-limit";
import { ancestorPaths, takePreviewKeyFromUrl } from "@/lib/preview-deep-link";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

export function FileBrowser() {
  const {
    data: files = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useFiles("", FILE_LIST_LIMIT);
  // Only used to say how much of the bucket this page is *not* showing.
  const { data: stats } = useFileStats();
  const deleteMutation = useDeleteFile();
  const downloadMutation = useDownloadUrl();
  const downloadingKey = downloadMutation.isPending
    ? (downloadMutation.variables?.key ?? null)
    : null;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileMetadata | null>(null);

  const tree = useMemo(() => buildFileTree(files), [files]);

  // Auto-expand the first time data arrives, deep enough that actual file rows
  // are on screen (see `initialExpandedPaths`) — expanding only the top level
  // could leave the page showing four folder rows and zero files while telling
  // the user to click one. The guard on `prev.size > 0` makes this idempotent
  // across refetches — once the user has toggled anything, their expansion
  // state is preserved (a deliberate UX improvement over the pre-TanStack-Query
  // version, which clobbered expansion state on every refresh).
  useEffect(() => {
    if (files.length === 0) return;
    // Syncing initial UI state once when async data first arrives is the
    // documented escape hatch for react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded((prev) => (prev.size > 0 ? prev : initialExpandedPaths(tree)));
  }, [files.length, tree]);

  // Deep link from the ⌘K palette or a dashboard row (`/files?preview=<key>`):
  // reveal the file's folders and open its preview, so picking a specific file
  // lands on that file instead of just navigating to this page.
  useEffect(() => {
    if (files.length === 0) return;
    const key = takePreviewKeyFromUrl();
    if (!key) return;
    const target = files.find((f) => f.key === key);
    if (!target) return;

    /* eslint-disable react-hooks/set-state-in-effect --
       syncing UI state once from the URL when async data first arrives is the
       documented escape hatch. */
    setExpanded((prev) => new Set([...prev, ...ancestorPaths(key)]));
    setPreviewFile(target);
    setPreviewOpen(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [files]);

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Download had no in-app feedback at all: the presign round trip happened
  // inside a bare click handler, so a slow call left the screen unchanged for
  // seconds and — once the click's user activation expired — `window.open` was
  // silently dropped and nothing happened. Now the click is a mutation (pending
  // state on the row + a toast), and the navigation is an anchor click that
  // survives an expired activation.
  const handleDownload = (file: FileMetadata) => {
    const toastId = toast.loading(`Preparing download for ${file.filename}...`);
    downloadMutation.mutate(file, {
      onSuccess: ({ url }) => {
        if (startBrowserDownload(url, file.filename)) {
          toast.success(`Downloading ${file.filename}`, { id: toastId });
        } else {
          toast.error(`Couldn't start the download for ${file.filename}`, {
            id: toastId,
          });
        }
      },
      onError: (err) => {
        const detail =
          err instanceof ApiError ? err.message : "Failed to get download URL";
        toast.error(detail, { id: toastId });
      },
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMutation.mutate(target.key, {
      onSuccess: () => {
        toast.success(`${target.filename} deleted`);
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : "Failed to delete file";
        toast.error(detail);
      },
      onSettled: () => setDeleteTarget(null),
    });
  };

  const handlePreview = (file: FileMetadata) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const truncationNotice = fileListTruncationNotice(
    files.length,
    stats?.total_files,
    FILE_LIST_LIMIT,
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 space-y-0">
          {/* Not "All Files": the endpoint returns the newest 100 objects. */}
          <CardTitle className="card-title">Recent Files</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="touch-target h-7 shrink-0 text-xs"
            disabled={isFetching}
            aria-label={isFetching ? "Refreshing file list" : "Refresh file list"}
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-3" aria-busy={isLoading || isFetching}>
          {isLoading ? (
            <div className="space-y-2 px-1 py-1">
              {/* Visible language, not `sr-only`: this list needs a full bucket
                  listing (measured 2.8s-21s), and six pulsing bars with no
                  words gave a sighted user no way to tell a slow listing from a
                  hung one. The notice escalates as the wait grows. */}
              <LoadingNotice className="px-2 pb-1" subject="files" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              error={error}
              title="Couldn't load files"
              onRetry={() => refetch()}
              className="px-4"
            />
          ) : files.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="This bucket is empty"
              description="Upload some files to see them listed here."
              action={
                <Button asChild size="sm">
                  <Link href="/upload">
                    <Upload aria-hidden="true" className="h-3.5 w-3.5" />
                    Upload files
                  </Link>
                </Button>
              }
              className="px-4"
            />
          ) : (
            <div className="space-y-0.5 overflow-hidden" aria-label="Files in bucket">
              {truncationNotice && (
                <p
                  className="mb-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                  role="note"
                >
                  {truncationNotice}
                </p>
              )}
              {tree.map((node) => (
                <FileTreeRow
                  key={node.type === "folder" ? node.path : node.data.key}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleFolder}
                  onPreview={handlePreview}
                  onDownload={handleDownload}
                  onDelete={setDeleteTarget}
                  downloadingKey={downloadingKey}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FilePreview
        file={previewFile}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={handleDownload}
        // Close the preview first: the delete confirmation is a separate
        // AlertDialog, and stacking it on the open preview would leave the
        // deleted file's dialog behind the confirmation.
        onDelete={(file) => {
          setPreviewOpen(false);
          setDeleteTarget(file);
        }}
        downloadingKey={downloadingKey}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              This will permanently delete{" "}
              <strong className="break-all font-semibold text-foreground">
                {deleteTarget?.filename}
              </strong>
              . This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              // Radix closes the dialog on action click, so the "Deleting..."
              // state below was never actually seen: measured, the dialog was
              // gone at ~239ms while the DELETE only returned at ~554ms, leaving
              // the row listed and indistinguishable from idle. Holding the
              // dialog open until the mutation settles makes the pending state
              // real — it matters more the slower the network is.
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
              disabled={deleteMutation.isPending}
              // Use the destructive variant so the confirm gets white-on-red
              // (AA in both themes); AlertDialogAction merges this over its
              // default variant.
              className={buttonVariants({ variant: "destructive" })}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
