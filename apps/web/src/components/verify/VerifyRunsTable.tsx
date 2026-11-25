"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunStatusBadge } from "./RunStatusBadge";
import type { VerifyRunSummary } from "@vibe-coding-starter-kit/shared";

interface VerifyRunsTableProps {
  runs: VerifyRunSummary[];
}

function formatRunDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VerifyRunsTable({ runs }: VerifyRunsTableProps) {
  const router = useRouter();

  return (
    <Table data-testid="verify-runs-table" className="table-fixed">
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="w-[28%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Run
          </TableHead>
          <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Status
          </TableHead>
          <TableHead className="w-[18%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tests
          </TableHead>
          <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Duration
          </TableHead>
          <TableHead className="w-[12%] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Commit
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow
            key={run.run_id}
            data-testid="verify-run-row"
            className="table-row-hover cursor-pointer"
            onClick={() => router.push(`/verify/${run.run_id}`)}
          >
            <TableCell className="font-medium">
              <div className="truncate">{formatRunDate(run.timestamp)}</div>
            </TableCell>
            <TableCell>
              <RunStatusBadge passed={run.passed} failed={run.failed} />
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
              {run.passed} / {run.total} passed
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground tabular-nums">
              {run.duration.toFixed(1)}s
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {run.git_sha.slice(0, 7)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
