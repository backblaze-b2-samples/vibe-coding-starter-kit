"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IssueCategory, B2Role } from "@vibe-coding-starter-kit/shared";

const CATEGORY_COLORS: Record<IssueCategory, string> = {
  sample_app_spec: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  bug: "bg-destructive/10 text-destructive border-destructive/30",
  enhancement: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  doc: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  meta: "bg-muted text-muted-foreground border-border",
  other: "bg-muted text-muted-foreground border-border",
};

interface IssueRowProps {
  issueNumber: number;
  title: string;
  htmlUrl: string;
  category: IssueCategory;
  b2Role: B2Role;
  specDepthScore: number;
  clusterLabel: string;
}

export function IssueRow({
  issueNumber,
  title,
  htmlUrl,
  category,
  b2Role,
  specDepthScore,
  clusterLabel,
}: IssueRowProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground tabular-nums mt-0.5 w-10 shrink-0">
        #{issueNumber}
      </span>
      <div className="flex-1 min-w-0">
        <a
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:underline flex items-center gap-1.5 group"
        >
          <span className="truncate">{title}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-60" />
        </a>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[category]}`}
          >
            {category.replace("_", " ")}
          </Badge>
          {b2Role !== "n/a" && (
            <span className="text-[10px] text-muted-foreground">b2:{b2Role}</span>
          )}
          <span className="text-[10px] text-muted-foreground">{clusterLabel}</span>
          {category === "sample_app_spec" && (
            <span className="text-[10px] text-muted-foreground">depth:{specDepthScore.toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
