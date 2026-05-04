"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileIcon,
  ImageIcon,
  FileTextIcon,
  FileArchiveIcon,
  FileVideoIcon,
  FileAudioIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FilePreview } from "./file-preview";
import { ApiError, getDownloadUrl } from "@/lib/api-client";
import { useDeleteFile, useFiles } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { buildFileTree, type TreeNode, type TreeFolder } from "@/lib/file-tree";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

// Stable component (declared at module scope, never re-created during
// render) so the React Compiler / lint rule treats it as a normal element.
function FileTypeIcon({
  contentType,
  className,
}: {
  contentType: string;
  className?: string;
}) {
  if (contentType.startsWith("image/")) return <ImageIcon className={className} />;
  if (contentType === "application/pdf") return <FileTextIcon className={className} />;
  if (contentType.startsWith("video/")) return <FileVideoIcon className={className} />;
  if (contentType.startsWith("audio/")) return <FileAudioIcon className={className} />;
  if (contentType === "application/zip") return <FileArchiveIcon className={className} />;
  return <FileIcon className={className} />;
}

function countFiles(node: TreeFolder): number {
  let count = 0;
  for (const child of node.children) {
    if (child.type === "file") count++;
    else count += countFiles(child);
  }
  return count;
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onPreview: (file: FileMetadata) => void;
  onDownload: (file: FileMetadata) => void;
  onDelete: (file: FileMetadata) => void;
}

function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onPreview,
  onDownload,
  onDelete,
}: TreeRowProps) {
  if (node.type === "folder") {
    const isOpen = expanded.has(node.path);
    const fileCount = countFiles(node);
    return (
      <>
        <button
          onClick={() => onToggle(node.path)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-accent/60 tree-row transition-colors group"
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-[var(--attention)]" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-[var(--attention)]" />
          )}
          <span className="font-medium truncate">{node.name}</span>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </span>
        </button>
        {isOpen &&
          node.children.map((child) => (
            <TreeRow
              key={child.type === "folder" ? child.path : child.data.key}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onPreview={onPreview}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
      </>
    );
  }

  const file = node.data;

  return (
    <div
      className="group flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-accent/60 tree-row transition-colors"
      style={{ paddingLeft: `${depth * 20 + 32}px` }}
    >
      <FileTypeIcon
        contentType={file.content_type}
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
      <span className="truncate">{node.name}</span>
      <span className="ml-auto flex items-center gap-4 shrink-0">
        <span className="font-mono text-xs text-muted-foreground tabular-nums hidden sm:inline">
          {file.size_human}
        </span>
        <span className="text-xs text-muted-foreground hidden md:inline">
          {formatDate(file.uploaded_at)}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onPreview(file)}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(file)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(file)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}

export function FileBrowser() {
  const { data: files = [], isLoading, isFetching, error, refetch } = useFiles();
  const deleteMutation = useDeleteFile();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileMetadata | null>(null);

  const tree = useMemo(() => buildFileTree(files), [files]);

  // Auto-expand top-level folders the first time data arrives. The guard
  // on `prev.size > 0` makes this idempotent across refetches — once the
  // user has toggled anything, their expansion state is preserved (this
  // is a deliberate UX improvement over the pre-TanStack-Query version,
  // which clobbered expansion state on every refresh).
  useEffect(() => {
    if (files.length === 0) return;
    // Syncing initial UI state once when async data first arrives is the
    // documented escape hatch for react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded((prev) => {
      if (prev.size > 0) return prev;
      const topFolders = tree
        .filter((n): n is TreeFolder => n.type === "folder")
        .map((f) => f.path);
      return new Set(topFolders);
    });
  }, [files.length, tree]);

  const toggleFolder = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleDownload = async (file: FileMetadata) => {
    try {
      const { url } = await getDownloadUrl(file.key);
      window.open(url, "_blank");
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : "Failed to get download URL";
      toast.error(detail);
    }
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

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4 px-5 space-y-0">
          <CardTitle className="card-title">All Files</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-xs"
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : files.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="This bucket is empty"
              description="Upload some files to see them listed here."
            />
          ) : (
            <div className="space-y-0.5">
              {tree.map((node) => (
                <TreeRow
                  key={node.type === "folder" ? node.path : node.data.key}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleFolder}
                  onPreview={handlePreview}
                  onDownload={handleDownload}
                  onDelete={setDeleteTarget}
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
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.filename}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
