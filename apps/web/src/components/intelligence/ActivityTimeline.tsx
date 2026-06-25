"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import type { WeeklyActivity } from "@vibe-coding-starter-kit/shared";

interface ActivityTimelineProps {
  data: WeeklyActivity[];
}

export function ActivityTimeline({ data }: ActivityTimelineProps) {
  const { chartData, config } = useMemo(() => {
    const weeks = [...new Set(data.map((d) => d.week))].sort();
    const clusterIds = [...new Set(data.map((d) => d.cluster_id))].filter((id) => id !== "unclustered");
    const clusterLabels: Record<string, string> = {};
    data.forEach((d) => { clusterLabels[d.cluster_id] = d.cluster_label; });

    const chartRows = weeks.map((week) => {
      const row: Record<string, string | number> = { week };
      clusterIds.forEach((cid) => {
        const match = data.find((d) => d.week === week && d.cluster_id === cid);
        row[cid] = match ? match.created_count : 0;
      });
      return row;
    });

    const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
    const cfg: ChartConfig = {};
    clusterIds.forEach((cid, i) => {
      cfg[cid] = { label: clusterLabels[cid] ?? cid, color: colors[i % colors.length] };
    });

    return { chartData: chartRows, config: cfg, clusterIds };
  }, [data]);

  const clusterIds = Object.keys(config);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="border-b border-border py-4 px-5">
          <CardTitle className="card-title">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <EmptyState icon={Activity} title="No activity data" description="Run the pipeline to see issue activity." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Issue Activity by Week</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <ChartContainer config={config} className="h-[240px] w-full">
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} width={28} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {clusterIds.slice(0, 5).map((cid) => (
              <Area
                key={cid}
                type="monotone"
                dataKey={cid}
                stackId="1"
                stroke={`var(--color-${cid})`}
                fill={`var(--color-${cid})`}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
