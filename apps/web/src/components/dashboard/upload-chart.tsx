"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
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

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Upload Activity</CardTitle>
        <CardDescription className="text-xs mt-0.5">
          Files uploaded over the last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 px-5">
        {data.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No activity yet"
            description="Upload files to see activity trends here."
          />
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="uploads"
                fill="var(--color-uploads)"
                radius={[3, 3, 0, 0]}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
