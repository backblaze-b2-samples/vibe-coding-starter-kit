"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { loadingCopy } from "@/lib/loading-progress";

/** How often the notice re-reads the clock. Fine-grained enough for 4s/12s. */
const TICK_MS = 500;

interface LoadingNoticeProps {
  /** What is loading, lowercase, used mid-sentence ("files", "bucket stats"). */
  subject: string;
  className?: string;
}

/**
 * On-screen (not `sr-only`) language for a wait that can take seconds, which
 * escalates the longer it runs — see `lib/loading-progress.ts` for the copy.
 *
 * Mount it only while the wait is actually happening: the elapsed clock starts
 * when the component mounts.
 */
export function LoadingNotice({ subject, className }: LoadingNoticeProps) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const { message, hint } = loadingCopy(elapsedMs, subject);

  return (
    <div
      aria-live="polite"
      className={className}
      role="status"
    >
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        {message}
      </p>
      {hint && (
        <p className="mt-1 max-w-prose text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
