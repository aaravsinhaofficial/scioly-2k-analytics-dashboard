"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { DeltaIndicator } from "@/components/DeltaIndicator";
import { OvrBadge } from "@/components/OvrBadge";
import { PlayerProfile } from "@/components/profile/PlayerProfile";
import type { PlayerDetail } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

type SortKey = "rank" | "name" | "ovr" | "study" | "build" | "points30" | "avg" | "medals" | "potential" | "events";

interface RosterTableProps {
  players: PlayerDetail[];
}

const columns: Array<{ key: SortKey; label: string; align?: "right" | "left" }> = [
  { key: "rank", label: "Rank" },
  { key: "name", label: "Player" },
  { key: "ovr", label: "OVR", align: "right" },
  { key: "study", label: "Study", align: "right" },
  { key: "build", label: "Build", align: "right" },
  { key: "potential", label: "Pot", align: "right" },
  { key: "medals", label: "Medals", align: "right" },
  { key: "points30", label: "30D Points", align: "right" },
  { key: "avg", label: "Avg Place", align: "right" },
  { key: "events", label: "Events" }
];

function sortValue(player: PlayerDetail, key: SortKey) {
  switch (key) {
    case "rank":
      return player.rank;
    case "name":
      return player.name;
    case "ovr":
      return player.ovrRating;
    case "study":
      return player.studyRating ?? -1;
    case "build":
      return player.buildRating ?? -1;
    case "points30":
      return player.thirtyDayPoints;
    case "avg":
      return player.avgPlacement ?? 999;
    case "medals":
      return player.medalCount;
    case "potential":
      return player.potentialRating;
    case "events":
      return player.profileEvents?.join(", ") ?? "";
    default:
      return player.rank;
  }
}

export function RosterTable({ players }: RosterTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ovr");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activePlayer, setActivePlayer] = useState<PlayerDetail | null>(null);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const aValue = sortValue(a, sortKey);
      const bValue = sortValue(b, sortKey);
      const modifier = sortDirection === "asc" ? 1 : -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * modifier;
      }

      return ((aValue as number) - (bValue as number)) * modifier;
    });
  }, [players, sortDirection, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "avg" || key === "rank" ? "asc" : "desc");
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border border-court-line bg-court-panel shadow-panel">
        <div className="flex flex-col gap-2 border-b border-court-line p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Main Roster
            </div>
            <h2 className="mt-1 text-2xl font-black italic uppercase text-white">Leaderboard</h2>
          </div>
          <div className="text-xs font-bold uppercase text-zinc-500">Click any row for player deep dive</div>
        </div>

        <div className="max-h-[760px] overflow-auto">
          <table className="w-full min-w-[1120px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={cn("px-4 py-3", column.align === "right" && "text-right")}>
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded text-left transition hover:text-white",
                        column.align === "right" && "justify-end"
                      )}
                    >
                      {column.label}
                      <ArrowDownUp className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr
                  key={player.id}
                  onClick={() => setActivePlayer(player)}
                  className="cursor-pointer border-t border-court-line transition hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-4 align-middle text-sm font-black text-zinc-500">#{player.rank}</td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-center gap-3">
                      <Avatar name={player.name} src={player.profilePictureUrl} />
                      <div className="min-w-0">
                        <div className="truncate font-black text-white">{player.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs font-bold uppercase text-zinc-500">
                          <span>{player.teamDesignation} Team</span>
                          <span>Grade {player.grade}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right align-middle">
                    <div className="inline-flex flex-col items-end gap-1">
                      <OvrBadge value={player.ovrRating} />
                      <DeltaIndicator delta={player.ovrDelta} compact metric="ovr" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right align-middle font-black text-white">
                    {player.studyRating ?? <span className="text-zinc-600">N/A</span>}
                  </td>
                  <td className="px-4 py-4 text-right align-middle font-black text-white">
                    {player.buildRating ?? <span className="text-zinc-600">N/A</span>}
                  </td>
                  <td className="px-4 py-4 text-right align-middle font-black text-pink-300">
                    {player.potentialRating.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-right align-middle font-black text-amber-200">
                    {player.medalCount}
                  </td>
                  <td className="px-4 py-4 text-right align-middle font-black text-cyan-300">
                    {formatNumber(player.thirtyDayPoints)}
                  </td>
                  <td className="px-4 py-4 text-right align-middle">
                    <div className="inline-flex flex-col items-end gap-1">
                      <span className="font-black text-white">
                        {typeof player.avgPlacement === "number" ? player.avgPlacement.toFixed(1) : "N/A"}
                      </span>
                      <DeltaIndicator delta={player.avgPlacementDelta} compact metric="placement" />
                    </div>
                  </td>
                  <td className="max-w-56 px-4 py-4 align-middle text-xs font-bold uppercase text-zinc-500">
                    <div className="truncate">{player.profileEvents?.length ? player.profileEvents.join(", ") : "Unlisted"}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activePlayer ? <PlayerProfile player={activePlayer} mode="modal" onClose={() => setActivePlayer(null)} /> : null}
    </>
  );
}
