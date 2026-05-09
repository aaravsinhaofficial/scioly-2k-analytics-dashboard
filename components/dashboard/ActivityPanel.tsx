import Link from "next/link";
import { Flame } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { OvrBadge } from "@/components/OvrBadge";
import type { PlayerDetail } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface ActivityPanelProps {
  players: PlayerDetail[];
}

export function ActivityPanel({ players }: ActivityPanelProps) {
  return (
    <div className="rounded-md border border-court-line bg-court-panel p-4">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="h-5 w-5 text-cyan-300" aria-hidden="true" />
        <h2 className="text-lg font-black italic uppercase text-white">30-Day Velocity</h2>
      </div>
      <div className="space-y-3">
        {players.slice(0, 6).map((player, index) => (
          <Link
            key={player.id}
            href={`/profile/${player.id}`}
            className="flex items-center gap-3 rounded-md border border-court-line bg-court-elevated p-3 transition hover:border-cyan-400/60"
          >
            <div className="w-5 text-xs font-black text-zinc-500">#{index + 1}</div>
            <Avatar name={player.name} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-white">{player.name}</div>
              <div className="text-xs font-bold uppercase text-zinc-500">{formatNumber(player.thirtyDayPoints)} pts</div>
            </div>
            <OvrBadge value={player.ovrRating} size="sm" />
          </Link>
        ))}
      </div>
    </div>
  );
}
