import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { DeltaValue } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DeltaIndicatorProps {
  delta?: DeltaValue;
  suffix?: string;
  compact?: boolean;
  metric?: "ovr" | "points" | "placement" | "generic";
}

export function DeltaIndicator({ delta, suffix = "", compact = false, metric = "generic" }: DeltaIndicatorProps) {
  const label =
    metric === "placement"
      ? "Placement trend, lower is better"
      : metric === "points"
        ? "Points trend"
        : metric === "ovr"
          ? "Overall rating trend"
          : "Trend";

  if (!delta || delta.direction === "flat") {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-zinc-500", compact ? "text-[10px]" : "text-xs")}
        title={`${label}: no change`}
      >
        <ArrowRight className="h-3 w-3" aria-hidden="true" />
        0{suffix}
      </span>
    );
  }

  const Icon = delta.direction === "up" ? ArrowUp : ArrowDown;
  const sign = delta.value > 0 ? "+" : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-black",
        compact ? "text-[10px]" : "text-xs",
        delta.isGood ? "text-emerald-400" : "text-red-400"
      )}
      title={`${label}: ${delta.isGood ? "improved" : "worse"}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {sign}
      {delta.value}
      {suffix}
    </span>
  );
}
