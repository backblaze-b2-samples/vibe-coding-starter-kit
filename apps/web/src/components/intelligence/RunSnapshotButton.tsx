"use client";

import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTriggerSnapshot } from "@/lib/queries";

export function RunSnapshotButton() {
  const { mutate, isPending } = useTriggerSnapshot();

  function handleRun() {
    mutate(undefined, {
      onSuccess: (data) => {
        toast.success(`Pipeline started — snapshot ${data.snapshot_id}`);
      },
      onError: (err) => {
        toast.error(`Failed to start pipeline: ${err.message}`);
      },
    });
  }

  return (
    <Button onClick={handleRun} disabled={isPending} size="sm">
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
      ) : (
        <Play className="h-4 w-4 mr-1.5" />
      )}
      {isPending ? "Starting…" : "Run Snapshot"}
    </Button>
  );
}
