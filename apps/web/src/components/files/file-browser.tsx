"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { FilePreview } from "./file-preview";
import { getFiles, getDownloadUrl, deleteFile } from "@/lib/api-client";
import { buildFileTree, type TreeNode, type TreeFolder } from "@/lib/file-tree";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType === "application/pdf") return FileTextIcon;
  if (contentType.startsWith("video/")) return FileVideoIcon;
  if (contentType.startsWith("audio/")) return FileAudioIcon;
  if (contentType === "application/zip") return FileArchiveIcon;
  return FileIcon;
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
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-blue-500" />
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
  const Icon = getFileIcon(file.content_type);

  return (
    <div
      className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
      style={{ paddingLeft: `${depth * 20 + 28}px` }}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
      <span className="ml-auto flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">
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
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileMetadata | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchFiles = useCallback(() => {
    setLoading(true);
    getFiles()
      .then((data) => {
        setFiles(data);
        // Auto-expand top-level folders
        const tree = buildFileTree(data);
        const topFolders = tree
          .filter((n): n is TreeFolder => n.type === "folder")
          .map((f) => f.path);
        setExpanded(new Set(topFolders));
      })
      .catch(() => {
        setFiles([]);
        toast.error("Failed to load files");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

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
    } catch {
      toast.error("Failed to get download URL");
    }
  };

  const handleDelete = async (file: FileMetadata) => {
    try {
      await deleteFile(file.key);
      setFiles((prev) => prev.filter((f) => f.key !== file.key));
      toast.success(`${file.filename} deleted`);
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const handlePreview = (file: FileMetadata) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const tree = buildFileTree(files);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Files</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchFiles}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No files found. Upload some files to get started.
            </p>
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
                  onDelete={handleDelete}
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
    </>
  );
}
