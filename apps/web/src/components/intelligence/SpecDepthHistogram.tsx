"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { SpecDepthBucket } from "@vibe-coding-starter-kit/shared";

const chartConfig = {
  count: { label: "Issues", color: "var(--chart-2)" },
} satisfies ChartConfig;

interface SpecDepthHistogramProps {
  data: SpecDepthBucket[];
}

export function SpecDepthHistogram({ data }: SpecDepthHistogramProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Spec Depth Distribution</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[160px] w-full">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="score_range" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} animationDuration={500} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
