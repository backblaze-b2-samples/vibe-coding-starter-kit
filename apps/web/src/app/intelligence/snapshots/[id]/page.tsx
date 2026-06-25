"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ActivityTimeline } from "@/components/intelligence/ActivityTimeline";
import { B2RoleDistribution } from "@/components/intelligence/B2RoleDistribution";
import { CategoryBreakdown } from "@/components/intelligence/CategoryBreakdown";
import { ClusterGrid } from "@/components/intelligence/ClusterGrid";
import { SnapshotPicker } from "@/components/intelligence/SnapshotPicker";
import { SpecDepthHistogram } from "@/components/intelligence/SpecDepthHistogram";
import { useSnapshotReport } from "@/lib/queries";
import type { IssueSummary } from "@vibe-coding-starter-kit/shared";

export default function SnapshotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: report, isLoading, error } = useSnapshotReport(id);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) return <ErrorState error={error} />;
  if (!report) return <p className="text-sm text-muted-foreground">Snapshot not found.</p>;

  const issuesByCluster: Record<string, IssueSummary[]> = {};
  report.top_specs.forEach((s) => {
    if (!issuesByCluster[s.cluster_id]) issuesByCluster[s.cluster_id] = [];
    issuesByCluster[s.cluster_id].push(s);
  });

  const fmtId = id.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/, "$1-$2-$3 $4:$5");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/intelligence/snapshots" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-3 w-3" /> All snapshots
          </Link>
          <h1 className="text-2xl font-bold">Snapshot {fmtId}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {report.repo} · {report.total_issues} issues
          </p>
        </div>
        <SnapshotPicker currentSnapshotId={id} />
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

      <ClusterGrid clusters={report.clusters} snapshotId={id} issuesByCluster={issuesByCluster} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown data={report.category_breakdown} />
        <B2RoleDistribution data={report.b2_role_distribution} />
      </div>

      <ActivityTimeline data={report.activity_timeline} />
      <SpecDepthHistogram data={report.spec_depth_histogram} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold mb-3">Most Detailed Specs</h2>
          {report.top_specs.map((s) => (
            <div key={s.issue_id} className="py-2 border-b border-border last:border-0">
              <a href={s.html_url} target="_blank" rel="noopener noreferrer"
                className="text-sm hover:underline">#{s.issue_number} {s.title}</a>
              <p className="text-xs text-muted-foreground mt-0.5">depth:{s.spec_depth_score.toFixed(1)} · {s.cluster_label}</p>
            </div>
          ))}
        </div>
        <div>
          <h2 className="text-sm font-semibold mb-3">Thinnest Issues</h2>
          {report.thin_issues.map((s) => (
            <div key={s.issue_id} className="py-2 border-b border-border last:border-0">
              <a href={s.html_url} target="_blank" rel="noopener noreferrer"
                className="text-sm hover:underline">#{s.issue_number} {s.title}</a>
              <p className="text-xs text-muted-foreground mt-0.5">depth:{s.spec_depth_score.toFixed(1)} · {s.category}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Link href={`/intelligence/snapshots/${id}/issues`} className="hover:underline">Browse all issues →</Link>
      </div>
    </div>
  );
}
