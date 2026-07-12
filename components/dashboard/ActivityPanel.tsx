import Link from "next/link";
import { Flame } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import type { PlayerDetail } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface ActivityPanelProps {
  players: PlayerDetail[];
}

export function ActivityPanel({ players }: ActivityPanelProps) {
  return (
    <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">Practice activity</h2>
      </div>
      <div className="space-y-3">
        {players.slice(0, 6).map((player, index) => (
          <Link
            key={player.id}
            href={`/profile/${player.id}`}
            className="flex items-center gap-3 rounded-md p-2.5 transition-colors hover:bg-court-elevated"
          >
            <div className="w-5 text-xs font-medium tabular-nums text-zinc-500">#{index + 1}</div>
            <Avatar name={player.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{player.name}</div>
              <div className="text-xs text-zinc-500">{formatNumber(player.thirtyDayPoints)} points in 30 days</div>
            </div>
            <ReadinessBadge value={player.readinessScore} status={player.readinessStatus} size="sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}
