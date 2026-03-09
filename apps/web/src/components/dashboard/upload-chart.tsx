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
      <CardHeader>
        <CardTitle>Upload Activity</CardTitle>
        <CardDescription>Files uploaded over the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No upload data available yet.
          </p>
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
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
