"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { RunStatusBadge } from "@/components/dashboard/RunStatusBadge";
import { useVerifyRun } from "@/lib/queries";

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}

export default function VerifyRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { data: run, isLoading, error, refetch } = useVerifyRun(runId);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !run) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in border-b border-border pb-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All runs
        </Link>
        <h1 className="page-title font-mono text-lg">{run.run_id}</h1>
      </div>

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Status
            </span>
            <RunStatusBadge passed={run.passed} failed={run.failed} />
          </div>
          <StatItem label="Tests" value={`${run.passed} / ${run.total} passed`} />
          <StatItem label="Duration" value={`${run.duration.toFixed(1)}s`} />
          <StatItem label="Commit" value={run.git_sha.slice(0, 7)} />
          <StatItem
            label="Time"
            value={new Date(run.timestamp).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Screenshots</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          {run.screenshot_urls.length === 0 ? (
            <p data-testid="verify-no-screenshots" className="text-sm text-muted-foreground">
              No screenshots stored for this run. Screenshots are uploaded on failure or with{" "}
              <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">VERIFY_RECORD=1</code>.
            </p>
          ) : (
            <div
              data-testid="verify-screenshot-grid"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              {run.screenshot_urls.map((url) => {
                const name = url.split("?")[0].split("/").pop() ?? url;
                return (
                  <button
                    key={url}
                    data-testid="verify-screenshot"
                    onClick={() => window.open(url, "_blank")}
                    className="group flex flex-col gap-2 text-left"
                  >
                    <div className="relative overflow-hidden rounded-md border border-border bg-muted aspect-video">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={name}
                        className="w-full h-full object-cover object-top group-hover:opacity-80 transition-opacity"
                      />
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="h-3.5 w-3.5 text-white drop-shadow" />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {run.trace_urls.length > 0 && (
        <Card data-testid="verify-traces">
          <CardHeader className="border-b border-border py-4 px-5">
            <CardTitle className="card-title">Traces</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <ul className="space-y-2">
              {run.trace_urls.map((url) => {
                const name = url.split("?")[0].split("/").pop() ?? url;
                return (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      {name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
