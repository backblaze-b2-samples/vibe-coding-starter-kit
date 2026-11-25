"use client";

import { Badge } from "@/components/ui/badge";

interface RunStatusBadgeProps {
  passed: number;
  failed: number;
}

export function RunStatusBadge({ passed: _passed, failed }: RunStatusBadgeProps) {
  if (failed === 0) {
    return (
      <Badge
        data-testid="verify-run-status"
        variant="outline"
        className="border-[var(--success)] text-[var(--success)] bg-transparent"
      >
        All passed
      </Badge>
    );
  }
  return (
    <Badge
      data-testid="verify-run-status"
      variant="destructive"
    >
      {failed} failed
    </Badge>
  );
}
