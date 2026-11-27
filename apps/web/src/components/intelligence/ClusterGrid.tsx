"use client";

import { ClusterCard } from "./ClusterCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Layers } from "lucide-react";
import type { Cluster, IssueSummary } from "@vibe-coding-starter-kit/shared";

interface ClusterGridProps {
  clusters: Cluster[];
  snapshotId: string;
  issuesByCluster?: Record<string, IssueSummary[]>;
}

export function ClusterGrid({ clusters, snapshotId, issuesByCluster = {} }: ClusterGridProps) {
  const named = clusters.filter((c) => c.cluster_id !== "unclustered");
  const unclustered = clusters.find((c) => c.cluster_id === "unclustered");

  if (clusters.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No clusters yet"
        description="Run the pipeline to generate clusters from issue embeddings."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {named
          .sort((a, b) => b.size - a.size)
          .map((cluster) => (
            <ClusterCard
              key={cluster.cluster_id}
              cluster={cluster}
              snapshotId={snapshotId}
              topIssues={issuesByCluster[cluster.cluster_id] ?? []}
            />
          ))}
      </div>
      {unclustered && unclustered.size > 0 && (
        <ClusterCard
          cluster={unclustered}
          snapshotId={snapshotId}
          topIssues={issuesByCluster["unclustered"] ?? []}
        />
      )}
    </div>
  );
}
