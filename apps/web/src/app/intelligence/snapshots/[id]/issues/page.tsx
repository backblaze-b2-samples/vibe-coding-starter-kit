"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { IssueRow } from "@/components/intelligence/IssueRow";
import { useSnapshotIssues, useSnapshotClusters } from "@/lib/queries";
import type { IssueCategory } from "@vibe-coding-starter-kit/shared";

const CATEGORIES: Array<{ value: IssueCategory | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "sample_app_spec", label: "Specs" },
  { value: "bug", label: "Bugs" },
  { value: "enhancement", label: "Enhancements" },
  { value: "doc", label: "Docs" },
  { value: "meta", label: "Meta" },
  { value: "other", label: "Other" },
];

const PAGE_SIZE = 50;

export default function IssueListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [category, setCategory] = useState<string>("");
  const [clusterId, setClusterId] = useState<string>("");
  const [offset, setOffset] = useState(0);

  const { data: clusters = [] } = useSnapshotClusters(id);
  const { data, isLoading, error } = useSnapshotIssues(id, {
    category: category || undefined,
    cluster_id: clusterId || undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const total = data?.total ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/intelligence/snapshots/${id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3 w-3" /> Snapshot overview
        </Link>
        <h1 className="text-2xl font-bold">Issues</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <Button
            key={c.value}
            variant={category === c.value ? "default" : "outline"}
            size="sm"
            onClick={() => { setCategory(c.value); setOffset(0); }}
          >
            {c.label}
          </Button>
        ))}
      </div>

      {clusters.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button variant={clusterId === "" ? "secondary" : "ghost"} size="sm" onClick={() => { setClusterId(""); setOffset(0); }}>
            All clusters
          </Button>
          {clusters.filter((c) => c.cluster_id !== "unclustered").map((c) => (
            <Button key={c.cluster_id} variant={clusterId === c.cluster_id ? "secondary" : "ghost"} size="sm"
              onClick={() => { setClusterId(c.cluster_id); setOffset(0); }}>
              {c.label}
            </Button>
          ))}
        </div>
      )}

      {isLoading && <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
      {error && <ErrorState error={error} />}

      {!isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No issues match these filters.</p>
      )}

      {items.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">{total} issues</p>
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
                clusterLabel={item.cluster_id}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
            <Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
