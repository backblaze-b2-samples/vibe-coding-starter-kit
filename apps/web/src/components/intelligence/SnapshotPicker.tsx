"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSnapshots } from "@/lib/queries";

interface SnapshotPickerProps {
  currentSnapshotId: string;
}

export function SnapshotPicker({ currentSnapshotId }: SnapshotPickerProps) {
  const router = useRouter();
  const { data: snapshots = [] } = useSnapshots();
  const complete = snapshots.filter((s) => s.status === "complete");

  if (complete.length <= 1) return null;

  return (
    <Select
      value={currentSnapshotId}
      onValueChange={(id) => router.push(`/intelligence/snapshots/${id}`)}
    >
      <SelectTrigger className="w-52 text-xs h-8">
        <SelectValue placeholder="Select snapshot" />
      </SelectTrigger>
      <SelectContent>
        {complete.map((s) => (
          <SelectItem key={s.snapshot_id} value={s.snapshot_id} className="text-xs">
            {s.snapshot_id.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/, "$1-$2-$3 $4:$5")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
