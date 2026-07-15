import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  href?: string;
  linkLabel?: string;
}

export function StatTile({ label, value, detail, href, linkLabel }: StatTileProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-zinc-500">{label}</div>
        {href ? <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-cyan-300" aria-hidden="true" /> : null}
      </div>
      <div className="mt-2 min-h-9 text-2xl font-semibold tabular-nums text-white">{value}</div>
      {detail ? <div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div> : null}
      {href && linkLabel ? <div className="mt-3 text-xs font-medium text-cyan-300">{linkLabel} →</div> : null}
    </>
  );

  const className = cn(
    "rounded-md border border-court-line bg-court-panel p-4 shadow-sm",
    href && "group block transition-colors hover:border-cyan-400 hover:bg-court-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
