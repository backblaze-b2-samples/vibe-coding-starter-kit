"use client";

import Link from "next/link";
import { CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { RunSnapshotButton } from "@/components/intelligence/RunSnapshotButton";
import { useSnapshots } from "@/lib/queries";
import type { SnapshotStatusValue } from "@vibe-coding-starter-kit/shared";

const STATUS_ICON: Record<SnapshotStatusValue, React.ReactNode> = {
  complete: <CheckCircle className="h-4 w-4 text-green-600" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  ingested: <Clock className="h-4 w-4 text-yellow-500" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
  unknown: <AlertCircle className="h-4 w-4 text-muted-foreground" />,
};

function formatSnapshotId(id: string) {
  return id.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3 $4:$5:$6 UTC");
}

export default function SnapshotsPage() {
  const { data: snapshots = [], isLoading, error } = useSnapshots();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Snapshots</h1>
        <RunSnapshotButton />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      )}

      {error && <ErrorState error={error} />}

      {!isLoading && snapshots.length === 0 && (
        <p className="text-sm text-muted-foreground">No snapshots yet. Run the pipeline to get started.</p>
      )}

      <div className="space-y-3">
        {snapshots.map((s) => (
          <Card key={s.snapshot_id} className={s.status === "complete" ? "card-hover" : ""}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {STATUS_ICON[s.status] ?? STATUS_ICON.unknown}
                  <CardTitle className="text-sm font-medium">
                    {s.status === "complete" ? (
                      <Link href={`/intelligence/snapshots/${s.snapshot_id}`} className="hover:underline">
                        {formatSnapshotId(s.snapshot_id)}
                      </Link>
                    ) : (
                      formatSnapshotId(s.snapshot_id)
                    )}
                  </CardTitle>
                </div>
                <Badge variant={s.status === "complete" ? "default" : "secondary"} className="text-xs">
                  {s.status}
                </Badge>
              </div>
            </CardHeader>
            {s.status === "complete" && (
              <CardContent className="px-4 pb-3">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{s.total_issues} issues</span>
                  <span>{s.open_issues} open</span>
                  <span>{s.cluster_count} clusters</span>
                  {s.pipeline_cost?.total_cost_usd !== undefined && (
                    <span>${s.pipeline_cost.total_cost_usd.toFixed(4)} pipeline cost</span>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
