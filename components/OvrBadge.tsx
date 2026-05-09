import { getRatingTier } from "@/lib/rating";
import { cn } from "@/lib/utils";

interface OvrBadgeProps {
  value: number;
  size?: "sm" | "md" | "lg";
  showTier?: boolean;
}

const sizes = {
  sm: "min-w-14 px-2 py-1 text-lg",
  md: "min-w-16 px-3 py-1.5 text-2xl",
  lg: "min-w-24 px-4 py-3 text-5xl"
};

export function OvrBadge({ value, size = "md", showTier = false }: OvrBadgeProps) {
  const tier = getRatingTier(value);

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md border font-black italic leading-none",
          sizes[size],
          tier.className,
          tier.glow && "shadow-opal"
        )}
        title={tier.name}
      >
        {Math.round(value)}
      </span>
      {showTier ? (
        <span className="hidden text-xs font-black uppercase text-zinc-400 sm:inline">{tier.name}</span>
      ) : null}
    </div>
  );
}
