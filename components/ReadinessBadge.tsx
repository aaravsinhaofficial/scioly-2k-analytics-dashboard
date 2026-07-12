import { cn } from "@/lib/utils";

interface ReadinessBadgeProps {
  value: number;
  status?: "Needs data" | "Developing" | "On track" | "Ready";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const sizes = {
  sm: "min-w-11 px-2 py-1 text-sm",
  md: "min-w-14 px-2.5 py-1.5 text-base",
  lg: "min-w-20 px-4 py-2.5 text-3xl"
};

function derivedStatus(value: number): NonNullable<ReadinessBadgeProps["status"]> {
  if (value >= 80) return "Ready";
  if (value >= 65) return "On track";
  if (value > 0) return "Developing";
  return "Needs data";
}

const tones: Record<NonNullable<ReadinessBadgeProps["status"]>, string> = {
  Ready: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "On track": "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  Developing: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  "Needs data": "border-court-line bg-court-elevated text-zinc-500"
};

export function ReadinessBadge({ value, status, size = "md", showLabel = false }: ReadinessBadgeProps) {
  const resolvedStatus: NonNullable<ReadinessBadgeProps["status"]> = status ?? derivedStatus(value);
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("inline-flex items-center justify-center rounded-md border font-semibold tabular-nums leading-none", sizes[size], tones[resolvedStatus])}>
        {Math.round(value)}
      </span>
      {showLabel ? <span className="hidden text-xs font-medium text-zinc-500 sm:inline">{resolvedStatus}</span> : null}
    </span>
  );
}
