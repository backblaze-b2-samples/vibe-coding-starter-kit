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
import { getFiles } from "@/lib/api-client";
import type { FileMetadata } from "@vibe-coding-starter-kit/shared";

const chartConfig = {
  uploads: {
    label: "Uploads",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function aggregateByDay(files: FileMetadata[]) {
  const counts: Record<string, number> = {};
  for (const file of files) {
    const day = new Date(file.uploaded_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    counts[day] = (counts[day] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([date, uploads]) => ({ date, uploads }))
    .slice(-7);
}

export function UploadChart() {
  const [data, setData] = useState<{ date: string; uploads: number }[]>([]);

  useEffect(() => {
    getFiles("", 1000)
      .then((files) => setData(aggregateByDay(files)))
      .catch(() => setData([]));
  }, []);

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
