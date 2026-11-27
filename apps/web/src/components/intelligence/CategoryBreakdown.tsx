"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";
import type { CategoryCount } from "@vibe-coding-starter-kit/shared";

const chartConfig = {
  count: { label: "Issues", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface CategoryBreakdownProps {
  data: CategoryCount[];
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  const chartData = data.map((d) => ({
    category: d.category.replace("_", " "),
    count: d.count,
    percentage: d.percentage,
  }));

  return (
    <Card>
      <CardHeader className="border-b border-border py-4 px-5">
        <CardTitle className="card-title">Category Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {chartData.length === 0 ? (
          <EmptyState icon={Tag} title="No classifications yet" description="Run the pipeline to classify issues." />
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                type="category"
                dataKey="category"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={76}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} animationDuration={500} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
