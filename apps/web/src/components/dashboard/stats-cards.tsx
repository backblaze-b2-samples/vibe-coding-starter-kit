"use client";

import { useEffect, useState } from "react";
import { FileIcon, HardDrive, Upload, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getFileStats } from "@/lib/api-client";
import { useRefresh } from "@/lib/refresh-context";
import type { UploadStats } from "@vibe-coding-starter-kit/shared";

export function StatsCards() {
  const [stats, setStats] = useState<UploadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshKey } = useRefresh();

  useEffect(() => {
    setLoading(true);
    getFileStats()
      .then(setStats)
      .catch(() => {
        setStats(null);
        toast.error("Failed to load stats");
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const cards = [
    { title: "Total Files", value: stats?.total_files ?? 0, unit: "files in bucket", icon: FileIcon },
    { title: "Storage Used", value: stats?.total_size_human ?? "0 B", unit: "across all files", icon: HardDrive },
    { title: "Uploads Today", value: stats?.uploads_today ?? 0, unit: "since midnight", icon: Upload },
    { title: "Total Downloads", value: stats?.total_downloads ?? 0, unit: "all time", icon: Download },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Card
          key={card.title}
          className={`card-hover animate-fade-in-up stagger-${i + 1}`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="stat-icon-wrap">
              <card.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-5">
            {loading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="stat-value">{card.value}</div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
              {card.unit}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
