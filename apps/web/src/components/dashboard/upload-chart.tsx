"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getUploadActivity } from "@/lib/api-client";
import { useRefresh } from "@/lib/refresh-context";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

const chartConfig = {
  uploads: {
    label: "Uploads",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function UploadChart() {
  const [data, setData] = useState<{ date: string; uploads: number }[]>([]);
  const { refreshKey } = useRefresh();

  useEffect(() => {
    getUploadActivity(7)
      .then((activity) =>
        setData(
          activity.map((d) => ({
            // Format ISO date to short display label
            date: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            uploads: d.uploads,
          }))
        )
      )
      .catch(() => setData([]));
  }, [refreshKey]);

  const total = data.reduce((sum, d) => sum + d.uploads, 0);

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Upload Activity</CardTitle>
        <CardDescription className="text-xs">Last 7 days</CardDescription>
        <CardAction className="text-right self-center">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total
          </div>
          <div className="text-lg font-semibold tabular-nums tracking-tight leading-tight">
            {total}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-5">
        {data.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No activity yet"
            description="Upload files to see activity trends here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="uploads-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-uploads)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--color-uploads)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="var(--border)"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                fontSize={11}
                width={28}
              />
              <ChartTooltip cursor={{ fill: "var(--accent-subtle)" }} content={<ChartTooltipContent />} />
              <Bar
                dataKey="uploads"
                fill="url(#uploads-fill)"
                radius={[4, 4, 0, 0]}
                animationDuration={500}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
