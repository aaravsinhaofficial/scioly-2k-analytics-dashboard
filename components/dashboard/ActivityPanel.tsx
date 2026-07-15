import Link from "next/link";
import { ChevronDown, Flame } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import type { PlayerDetail } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface ActivityPanelProps {
  players: PlayerDetail[];
}

export function ActivityPanel({ players }: ActivityPanelProps) {
  return (
    <details open className="group/disclosure overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm" aria-labelledby="practice-activity-heading">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-4 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400">
        <span className="flex min-w-0 items-center gap-2">
          <Flame className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
          <h2 id="practice-activity-heading" className="text-lg font-semibold text-white">Recent practice leaders</h2>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open/disclosure:rotate-180" aria-hidden="true" />
      </summary>
      <ol className="space-y-3 border-t border-court-line p-4">
        {players.slice(0, 6).map((player, index) => (
          <li key={player.id}>
            <Link
              href={`/profile/${player.id}`}
              className="flex items-center gap-3 rounded-md p-2.5 transition-colors hover:bg-court-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
            <div className="w-5 text-xs font-medium tabular-nums text-zinc-500">#{index + 1}</div>
            <Avatar name={player.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{player.name}</div>
              <div className="text-xs text-zinc-500">{formatNumber(player.thirtyDayPoints)} points in 30 days</div>
            </div>
            <ReadinessBadge value={player.readinessScore} status={player.readinessStatus} size="sm" />
            </Link>
          </li>
        ))}
        {players.length === 0 ? <li className="rounded-md border border-dashed border-court-line p-4 text-sm text-zinc-500">No approved practice activity in the last 30 days.</li> : null}
      </ol>
    </details>
  );
}
