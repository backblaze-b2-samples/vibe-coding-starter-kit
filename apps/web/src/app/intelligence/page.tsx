"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import { ActivityTimeline } from "@/components/intelligence/ActivityTimeline";
import { B2RoleDistribution } from "@/components/intelligence/B2RoleDistribution";
import { CategoryBreakdown } from "@/components/intelligence/CategoryBreakdown";
import { ClusterGrid } from "@/components/intelligence/ClusterGrid";
import { RunSnapshotButton } from "@/components/intelligence/RunSnapshotButton";
import { SpecDepthHistogram } from "@/components/intelligence/SpecDepthHistogram";
import { useSnapshots, useSnapshotReport } from "@/lib/queries";
import type { IssueSummary } from "@vibe-coding-starter-kit/shared";

export default function IntelligencePage() {
  const { data: snapshots = [], isLoading: loadingSnapshots, error: snapshotsError } = useSnapshots();
  const latest = snapshots.find((s) => s.status === "complete");
  const { data: report, isLoading: loadingReport, error: reportError } = useSnapshotReport(latest?.snapshot_id);

  if (loadingSnapshots || loadingReport) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (snapshotsError || reportError) {
    return <ErrorState error={snapshotsError ?? reportError} />;
  }

  if (!latest || !report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Issue Intelligence</h1>
          <RunSnapshotButton />
        </div>
        <EmptyState
          icon={BarChart3}
          title="No snapshots yet"
          description="Run a snapshot to analyze the backlog — it will embed, classify, and cluster all issues."
        />
      </div>
    );
  }

  const issuesByCluster: Record<string, IssueSummary[]> = {};
  report.top_specs.forEach((s) => {
    if (!issuesByCluster[s.cluster_id]) issuesByCluster[s.cluster_id] = [];
    issuesByCluster[s.cluster_id].push(s);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Issue Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {report.repo} · {report.total_issues} issues · snapshot {latest.snapshot_id.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/, "$1-$2-$3 $4:$5")}
          </p>
        </div>
        <RunSnapshotButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Issues", value: report.total_issues },
          { label: "Open", value: report.open_issues },
          { label: "Clusters", value: report.clusters.filter((c) => c.cluster_id !== "unclustered").length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <ClusterGrid clusters={report.clusters} snapshotId={latest.snapshot_id} issuesByCluster={issuesByCluster} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown data={report.category_breakdown} />
        <B2RoleDistribution data={report.b2_role_distribution} />
      </div>

      <ActivityTimeline data={report.activity_timeline} />
      <SpecDepthHistogram data={report.spec_depth_histogram} />
    </div>
  );
}
