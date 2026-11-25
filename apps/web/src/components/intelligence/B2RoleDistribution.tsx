"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { B2RoleCount } from "@vibe-coding-starter-kit/shared";

const ROLE_LABELS: Record<string, string> = {
  central: "Central",
  supporting: "Supporting",
  incidental: "Incidental",
  unclear: "Unclear",
  "n/a": "N/A",
};

const ROLE_COLORS: Record<string, string> = {
  central: "bg-chart-1",
  supporting: "bg-chart-2",
  incidental: "bg-chart-3",
  unclear: "bg-chart-4",
  "n/a": "bg-muted",
};

interface B2RoleDistributionProps {
  data: B2RoleCount[];
}

export function B2RoleDistribution({ data }: B2RoleDistributionProps) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">B2 Role (Spec Issues)</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {data.map((d) => {
              const pct = total ? Math.round((d.count / total) * 100) : 0;
              const colorClass = ROLE_COLORS[d.role] ?? "bg-muted";
              return (
                <div key={d.role} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted-foreground shrink-0">
                    {ROLE_LABELS[d.role] ?? d.role}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${colorClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs tabular-nums text-right">{d.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
