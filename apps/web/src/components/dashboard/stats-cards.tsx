"use client";

import { useEffect, useState } from "react";
import { FileIcon, HardDrive, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getFileStats } from "@/lib/api-client";
import type { UploadStats } from "@oss-starter-kit/shared";

export function StatsCards() {
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFileStats()
      .then(setStats)
      .catch(() => {
        // Use placeholder data when API is unavailable
        setStats({
          total_files: 0,
          total_size_bytes: 0,
          total_size_human: "0 B",
          uploads_today: 0,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      title: "Total Files",
      value: stats?.total_files ?? 0,
      icon: FileIcon,
    },
    {
      title: "Storage Used",
      value: stats?.total_size_human ?? "0 B",
      icon: HardDrive,
    },
    {
      title: "Uploads Today",
      value: stats?.uploads_today ?? 0,
      icon: Upload,
    },
    {
      title: "Total Downloads",
      value: "—",
      icon: Download,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
