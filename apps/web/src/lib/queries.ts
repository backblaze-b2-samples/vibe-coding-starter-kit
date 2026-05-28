"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  deleteFile,
  getFiles,
  getFileStats,
  getPreviewUrl,
  getSnapshotActivity,
  getSnapshotClusters,
  getSnapshotIssues,
  getSnapshotReport,
  getUploadActivity,
  listSnapshots,
  triggerSnapshot,
} from "@/lib/api-client";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

// Single source of truth for query keys. Keep these tightly scoped so that
// invalidating "files" doesn't blow away unrelated caches, and so an IDE
// "find usages" of `qk.files` reveals every consumer.
export const qk = {
  all: ["b2"] as const,
  files: (prefix?: string, limit?: number) =>
    [...qk.all, "files", prefix ?? "", limit ?? 100] as const,
  stats: () => [...qk.all, "stats"] as const,
  uploadActivity: (days: number) =>
    [...qk.all, "stats", "activity", days] as const,
  preview: (key: string) => [...qk.all, "preview", key] as const,
  intel: ["intelligence"] as const,
  snapshots: () => [...qk.intel, "snapshots"] as const,
  snapshotReport: (id: string) => [...qk.intel, "snapshot", id] as const,
  snapshotIssues: (id: string, filters?: object) =>
    [...qk.intel, "snapshot", id, "issues", filters ?? {}] as const,
  snapshotClusters: (id: string) => [...qk.intel, "snapshot", id, "clusters"] as const,
  snapshotActivity: (id: string) => [...qk.intel, "snapshot", id, "activity"] as const,
};

export function useFiles(prefix = "", limit = 100) {
  return useQuery<FileMetadata[], ApiError>({
    queryKey: qk.files(prefix, limit),
    queryFn: () => getFiles(prefix, limit),
  });
}

export function useFileStats() {
  return useQuery({
    queryKey: qk.stats(),
    queryFn: getFileStats,
  });
}

export function useUploadActivity(days = 7) {
  return useQuery({
    queryKey: qk.uploadActivity(days),
    queryFn: () => getUploadActivity(days),
  });
}

// Presigned preview URL — only fetched when `enabled` is true (e.g., when
// the dialog opens for a specific file). Kept short-lived (60s) because
// the URL itself has a presigned expiry and is cheap to regenerate.
export function usePreviewUrl(key: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.preview(key ?? ""),
    queryFn: () => getPreviewUrl(key as string),
    enabled: enabled && !!key,
    staleTime: 60_000,
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileKey: string) => deleteFile(fileKey),
    // After delete, blow away every cached file list + stats. Cheap and
    // correct — the dashboard re-fetches lazily as components remount.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.all });
    },
  });
}

// --- Intelligence hooks ---

export function useSnapshots() {
  return useQuery({
    queryKey: qk.snapshots(),
    queryFn: listSnapshots,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRunning = Array.isArray(data) && data.some((s) => s.status === "running");
      return hasRunning ? 3000 : false;
    },
  });
}

export function useSnapshotReport(snapshotId: string | undefined) {
  return useQuery({
    queryKey: qk.snapshotReport(snapshotId ?? ""),
    queryFn: () => getSnapshotReport(snapshotId as string),
    enabled: !!snapshotId,
  });
}

export function useSnapshotIssues(
  snapshotId: string | undefined,
  filters: { cluster_id?: string; category?: string; min_spec_depth?: number; limit?: number; offset?: number } = {}
) {
  return useQuery({
    queryKey: qk.snapshotIssues(snapshotId ?? "", filters),
    queryFn: () => getSnapshotIssues(snapshotId as string, filters),
    enabled: !!snapshotId,
  });
}

export function useSnapshotClusters(snapshotId: string | undefined) {
  return useQuery({
    queryKey: qk.snapshotClusters(snapshotId ?? ""),
    queryFn: () => getSnapshotClusters(snapshotId as string),
    enabled: !!snapshotId,
  });
}

export function useSnapshotActivity(snapshotId: string | undefined) {
  return useQuery({
    queryKey: qk.snapshotActivity(snapshotId ?? ""),
    queryFn: () => getSnapshotActivity(snapshotId as string),
    enabled: !!snapshotId,
  });
}

export function useTriggerSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repo?: string) => triggerSnapshot(repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.snapshots() });
    },
  });
}
