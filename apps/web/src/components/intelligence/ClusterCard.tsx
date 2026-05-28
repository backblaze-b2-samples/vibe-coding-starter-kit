"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Cluster, IssueSummary } from "@vibe-coding-starter-kit/shared";

interface ClusterCardProps {
  cluster: Cluster;
  snapshotId: string;
  topIssues?: IssueSummary[];
}

export function ClusterCard({ cluster, snapshotId, topIssues = [] }: ClusterCardProps) {
  const isUnclustered = cluster.cluster_id === "unclustered";

  return (
    <Card className={isUnclustered ? "opacity-70" : "card-hover"}>
      <CardHeader className="pb-2 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">
            <Link
              href={`/intelligence/snapshots/${snapshotId}/clusters/${cluster.cluster_id}`}
              className="hover:underline"
            >
              {cluster.label}
            </Link>
          </CardTitle>
          <Badge variant="secondary" className="shrink-0 text-xs tabular-nums">
            {cluster.size}
          </Badge>
        </div>
        {cluster.summary && (
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{cluster.summary}</p>
        )}
      </CardHeader>
      {topIssues.length > 0 && (
        <CardContent className="px-4 pb-4">
          <ul className="space-y-1">
            {topIssues.slice(0, 3).map((issue) => (
              <li key={issue.issue_id} className="text-xs text-muted-foreground truncate">
                <a
                  href={issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground hover:underline"
                >
                  #{issue.issue_number} {issue.title}
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
      {topIssues.length === 0 && (
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="h-3 w-3" />
            <span>{cluster.size} issues</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
