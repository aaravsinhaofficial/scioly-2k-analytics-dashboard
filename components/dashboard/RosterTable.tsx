"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, Columns3, Download, Search, Trophy } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import { PlayerProfile } from "@/components/profile/PlayerProfile";
import type { PlayerDetail } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

type SortKey = "rank" | "name" | "readiness" | "study" | "build" | "points30" | "avg" | "medals" | "events";

interface RosterTableProps {
  players: PlayerDetail[];
}

const columns: Array<{ key: SortKey; label: string; align?: "right" | "left"; secondary?: boolean }> = [
  { key: "rank", label: "Rank" },
  { key: "name", label: "Student" },
  { key: "readiness", label: "Readiness", align: "right" },
  { key: "study", label: "Study", align: "right", secondary: true },
  { key: "build", label: "Build", align: "right", secondary: true },
  { key: "medals", label: "Medals", align: "right", secondary: true },
  { key: "points30", label: "30-day points", align: "right" },
  { key: "avg", label: "Avg. place", align: "right" },
  { key: "events", label: "Events", secondary: true },
];

function sortValue(player: PlayerDetail, key: SortKey) {
  switch (key) {
    case "rank": return player.rank;
    case "name": return player.name;
    case "readiness": return player.readinessScore;
    case "study": return player.studyRating ?? -1;
    case "build": return player.buildRating ?? -1;
    case "points30": return player.thirtyDayPoints;
    case "avg": return player.avgPlacement ?? 999;
    case "medals": return player.medalCount;
    case "events": return player.profileEvents?.join(", ") ?? "";
  }
}

export function RosterTable({ players }: RosterTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("readiness");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [showAllColumns, setShowAllColumns] = useState(false);
  const [activePlayer, setActivePlayer] = useState<PlayerDetail | null>(null);

  const teamOptions = useMemo(
    () => Array.from(new Set(players.map((player) => player.teamDesignation))).sort(),
    [players]
  );

  const sortedPlayers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return [...players]
      .filter((player) => {
        const matchesTeam = teamFilter === "all" || player.teamDesignation === teamFilter;
        const matchesSearch = !normalizedSearch ||
          player.name.toLowerCase().includes(normalizedSearch) ||
          player.teamDesignation.toLowerCase().includes(normalizedSearch) ||
          String(player.grade).includes(normalizedSearch) ||
          player.profileEvents?.some((event) => event.toLowerCase().includes(normalizedSearch));
        return matchesTeam && matchesSearch;
      })
      .sort((a, b) => {
        const aValue = sortValue(a, sortKey);
        const bValue = sortValue(b, sortKey);
        const modifier = sortDirection === "asc" ? 1 : -1;
        if (typeof aValue === "string" && typeof bValue === "string") {
          return aValue.localeCompare(bValue) * modifier;
        }
        return ((aValue as number) - (bValue as number)) * modifier;
      });
  }, [players, searchQuery, sortDirection, sortKey, teamFilter]);

  const visibleColumns = showAllColumns ? columns : columns.filter((column) => !column.secondary);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(key === "avg" || key === "rank" || key === "name" ? "asc" : "desc");
  }

  return (
    <>
      <section className="overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm" aria-labelledby="roster-heading" data-tour="roster">
        <div className="border-b border-court-line p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-cyan-300">
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Team standings
              </div>
              <h2 id="roster-heading" className="mt-1 text-xl font-semibold text-white sm:text-2xl">Team roster</h2>
              <p className="mt-1 text-sm text-zinc-500">{sortedPlayers.length} of {players.length} students</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 sm:w-64">
                <span className="sr-only">Search students</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search students or events"
                  className="h-11 w-full rounded-md border border-court-line bg-court-panel pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
              </label>
              <label>
                <span className="sr-only">Filter by team</span>
                <select
                  value={teamFilter}
                  onChange={(event) => setTeamFilter(event.target.value)}
                  className="h-11 w-full rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none focus:border-cyan-400 sm:w-28"
                >
                  <option value="all">All teams</option>
                  {teamOptions.map((team) => <option key={team} value={team}>Team {team}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setShowAllColumns((current) => !current)}
                className="hidden h-11 items-center justify-center gap-2 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 transition hover:border-cyan-400 hover:text-white md:inline-flex"
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                {showAllColumns ? "Fewer columns" : "More columns"}
              </button>
              <a
                href="/api/export"
                download
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 transition hover:border-cyan-400 hover:text-white"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span className="sm:hidden lg:inline">Export</span>
              </a>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 md:hidden">
            <label className="flex-1">
              <span className="sr-only">Sort students</span>
              <select
                value={sortKey}
                onChange={(event) => {
                  const nextKey = event.target.value as SortKey;
                  setSortKey(nextKey);
                  setSortDirection(nextKey === "avg" || nextKey === "rank" || nextKey === "name" ? "asc" : "desc");
                }}
                className="h-11 w-full rounded-md border border-court-line bg-court-panel px-3 text-sm text-white"
              >
                {columns.map((column) => <option key={column.key} value={column.key}>Sort by {column.label}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}
              className="grid h-11 w-11 place-items-center rounded-md border border-court-line text-zinc-600"
              aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
            >
              {sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="hidden max-h-[760px] overflow-auto md:block">
          <table className={cn("w-full border-collapse text-left", showAllColumns && "min-w-[1040px]") }>
            <thead className="sticky top-0 z-10 bg-court-elevated text-xs font-medium text-zinc-500">
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.key} className={cn("px-4 py-3", column.align === "right" && "text-right")}>
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded text-left transition hover:text-white",
                        column.align === "right" && "justify-end",
                        sortKey === column.key && "font-semibold text-cyan-300"
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
                <tr key={player.id} className="border-t border-court-line transition-colors hover:bg-court-elevated">
                  {visibleColumns.map((column) => {
                    if (column.key === "rank") return <td key={column.key} className="px-4 py-3 text-sm tabular-nums text-zinc-500">#{player.rank}</td>;
                    if (column.key === "name") return (
                      <td key={column.key} className="px-4 py-3">
                        <button type="button" onClick={() => setActivePlayer(player)} className="flex items-center gap-3 text-left">
                          <Avatar name={player.name} src={player.profilePictureUrl} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white hover:text-cyan-300">{player.name}</span>
                            <span className="mt-0.5 block text-xs text-zinc-500">Team {player.teamDesignation} · Grade {player.grade}</span>
                          </span>
                        </button>
                      </td>
                    );
                    if (column.key === "readiness") return <td key={column.key} className="px-4 py-3 text-right"><ReadinessBadge value={player.readinessScore} status={player.readinessStatus} size="sm" /></td>;
                    if (column.key === "study") return <td key={column.key} className="px-4 py-3 text-right font-medium tabular-nums text-white">{player.studyRating ?? <span className="text-zinc-500">—</span>}</td>;
                    if (column.key === "build") return <td key={column.key} className="px-4 py-3 text-right font-medium tabular-nums text-white">{player.buildRating ?? <span className="text-zinc-500">—</span>}</td>;
                    if (column.key === "medals") return <td key={column.key} className="px-4 py-3 text-right font-medium tabular-nums text-white">{player.medalCount}</td>;
                    if (column.key === "points30") return <td key={column.key} className="px-4 py-3 text-right font-medium tabular-nums text-cyan-300">{formatNumber(player.thirtyDayPoints)}</td>;
                    if (column.key === "avg") return <td key={column.key} className="px-4 py-3 text-right"><span className="font-medium tabular-nums text-white">{typeof player.avgPlacement === "number" ? player.avgPlacement.toFixed(1) : "—"}</span></td>;
                    return <td key={column.key} className="max-w-52 px-4 py-3 text-xs text-zinc-500"><div className="truncate">{player.profileEvents?.length ? player.profileEvents.join(", ") : "Not listed"}</div></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-court-line md:hidden">
          {sortedPlayers.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => setActivePlayer(player)}
              className="block w-full p-4 text-left transition-colors hover:bg-court-elevated"
            >
              <span className="flex items-start gap-3">
                <span className="pt-2 text-xs font-medium tabular-nums text-zinc-500">#{player.rank}</span>
                <Avatar name={player.name} src={player.profilePictureUrl} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">{player.name}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">Team {player.teamDesignation} · Grade {player.grade}</span>
                    </span>
                    <ReadinessBadge value={player.readinessScore} status={player.readinessStatus} size="sm" />
                  </span>
                  <span className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <span><span className="block text-zinc-500">30-day points</span><span className="mt-0.5 block font-semibold tabular-nums text-white">{formatNumber(player.thirtyDayPoints)}</span></span>
                    <span><span className="block text-zinc-500">Avg. place</span><span className="mt-0.5 block font-semibold tabular-nums text-white">{typeof player.avgPlacement === "number" ? player.avgPlacement.toFixed(1) : "—"}</span></span>
                    <span><span className="block text-zinc-500">Medals</span><span className="mt-0.5 block font-semibold tabular-nums text-white">{player.medalCount}</span></span>
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {sortedPlayers.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-white">No students found</p>
            <p className="mt-1 text-sm text-zinc-500">Try a different search or team filter.</p>
          </div>
        ) : null}
      </section>

      {activePlayer ? <PlayerProfile player={activePlayer} mode="modal" onClose={() => setActivePlayer(null)} /> : null}
    </>
  );
}
