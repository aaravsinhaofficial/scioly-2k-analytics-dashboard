import type { PointLogStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusClass: Record<PointLogStatus, string> = {
  pending: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  approved: "border-emerald-300/40 bg-emerald-300/10 text-emerald-200",
  rejected: "border-red-300/40 bg-red-300/10 text-red-200"
};

export function StatusBadge({ status }: { status: PointLogStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-1 text-[11px] font-black uppercase",
        statusClass[status]
      )}
    >
      {status}
    </span>
  );
}
