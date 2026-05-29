"use client";

import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { VerifyRunsTable } from "@/components/dashboard/VerifyRunsTable";
import { useVerifyRuns } from "@/lib/queries";

export default function VerifyDashboardPage() {
  const { data: runs, isLoading, error, refetch } = useVerifyRuns();

  return (
    <div className="space-y-8" data-testid="verify-dashboard">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Verification Runs</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Playwright test evidence stored in Backblaze B2.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div data-testid="verify-dashboard-loading" className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div data-testid="verify-dashboard-error">
              <ErrorState error={error} onRetry={() => refetch()} />
            </div>
          ) : !runs || runs.length === 0 ? (
            <div data-testid="verify-dashboard-empty">
              <EmptyState
                icon={FolderOpen}
                title="No verification runs yet."
                description="Run pnpm verify to create the first one."
                action={
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded border border-border">
                    pnpm verify
                  </code>
                }
              />
            </div>
          ) : (
            <VerifyRunsTable runs={runs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
