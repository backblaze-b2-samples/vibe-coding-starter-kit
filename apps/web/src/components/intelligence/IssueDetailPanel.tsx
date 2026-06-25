"use client";

import { ExternalLink, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IssueCategory, IssueSummary } from "@vibe-coding-starter-kit/shared";

const CATEGORY_LABELS: Record<IssueCategory, string> = {
  sample_app_spec: "Sample App Spec",
  bug: "Bug",
  enhancement: "Enhancement",
  doc: "Documentation",
  meta: "Meta",
  other: "Other",
};

interface IssueDetailPanelProps {
  issue: IssueSummary;
  onClose: () => void;
}

export function IssueDetailPanel({ issue, onClose }: IssueDetailPanelProps) {
  return (
    <div className="border border-border rounded-lg p-5 bg-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">#{issue.issue_number}</span>
            <Badge variant="outline" className="text-[10px]">
              {CATEGORY_LABELS[issue.category]}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm leading-snug">{issue.title}</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Cluster</span>
          <p className="font-medium mt-0.5">{issue.cluster_label}</p>
        </div>
        <div>
          <span className="text-muted-foreground">B2 Role</span>
          <p className="font-medium mt-0.5">{issue.b2_role}</p>
        </div>
        {issue.category === "sample_app_spec" && (
          <div>
            <span className="text-muted-foreground">Spec Depth</span>
            <p className="font-medium mt-0.5">{issue.spec_depth_score.toFixed(1)} / 10</p>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        Issue body is shown on GitHub. This panel shows classification metadata only.
      </div>

      <a
        href={issue.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      >
        View on GitHub <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
