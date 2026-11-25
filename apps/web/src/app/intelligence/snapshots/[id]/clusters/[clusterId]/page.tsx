"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { IssueRow } from "@/components/intelligence/IssueRow";
import { useSnapshotClusters, useSnapshotIssues } from "@/lib/queries";

export default function ClusterDetailPage({
  params,
}: {
  params: Promise<{ id: string; clusterId: string }>;
}) {
  const { id, clusterId } = use(params);

  const { data: clusters = [], isLoading: loadingClusters } = useSnapshotClusters(id);
  const cluster = clusters.find((c) => c.cluster_id === clusterId);

  const { data, isLoading: loadingIssues, error } = useSnapshotIssues(id, {
    cluster_id: clusterId,
    limit: 200,
  });
  const items = data?.items ?? [];

  if (loadingClusters || loadingIssues) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24" />
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      </div>
    );
  }

  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/intelligence/snapshots/${id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Snapshot overview
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{cluster?.label ?? clusterId}</h1>
          {cluster && <Badge variant="secondary">{cluster.size} issues</Badge>}
        </div>
        {cluster?.summary && (
          <p className="text-sm text-muted-foreground mt-1">{cluster.summary}</p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues in this cluster.</p>
      ) : (
        <div>
          {items.map((item) => (
            <IssueRow
              key={item.issue_id}
              issueNumber={item.issue_number}
              title={item.title}
              htmlUrl={item.html_url}
              category={item.category}
              b2Role={item.b2_role}
              specDepthScore={item.spec_depth_score}
              clusterLabel={cluster?.label ?? clusterId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
