"use client";

import Link from "next/link";
import { Crown, Gauge, Medal } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import type { TeamComparison } from "@/lib/types";

interface TeamComparisonViewProps {
  teams: TeamComparison[];
  initialTeamDesignation?: string;
}

export function TeamComparisonView({ teams, initialTeamDesignation }: TeamComparisonViewProps) {
  const initialTeam = teams.find(
    (team) => team.designation.toLowerCase() === initialTeamDesignation?.toLowerCase()
  );
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeam?.id ?? teams[0]?.id ?? "");
  const [compare, setCompare] = useState(false);
  const visibleTeams = compare ? teams : teams.filter((team) => team.id === selectedTeamId);

  if (teams.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-court-line bg-court-panel p-8 text-center">
        <UsersEmptyState />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-court-line bg-court-panel p-3 shadow-sm">
        <p className="mb-2 text-xs font-medium text-zinc-500">Choose one team, or compare every roster.</p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose team view">
        {teams.map((team) => (
          <button key={team.id} type="button" onClick={() => { setSelectedTeamId(team.id); setCompare(false); }} className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${!compare && selectedTeamId === team.id ? "bg-white text-black" : "text-zinc-600 hover:bg-court-elevated hover:text-white"}`} aria-pressed={!compare && selectedTeamId === team.id}>{team.name || `Team ${team.designation}`}</button>
        ))}
        <button type="button" onClick={() => setCompare(true)} className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${compare ? "bg-white text-black" : "text-zinc-600 hover:bg-court-elevated hover:text-white"}`} aria-pressed={compare}>Compare all</button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {compare
          ? `Comparing all ${visibleTeams.length} teams.`
          : visibleTeams[0]
            ? `Showing ${visibleTeams[0].name || `Team ${visibleTeams[0].designation}`}.`
            : "No team selected."}
      </p>
      <div className={`grid gap-4 ${compare ? "xl:grid-cols-3" : "max-w-3xl"}`}>
      {visibleTeams.map((team) => (
        <section key={team.id} aria-labelledby={`team-${team.id}-heading`} className="overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm">
          <div className="border-b border-court-line p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-zinc-500">{team.schoolName}</div>
                <h2 id={`team-${team.id}-heading`} className="mt-1 break-words text-2xl font-semibold text-white">{team.name || `Team ${team.designation}`}</h2>
              </div>
              <ReadinessBadge value={team.teamReadiness} size="md" showLabel />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-court-elevated p-3">
                <Gauge className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-zinc-500">Latest SOS</div>
                <div className="font-semibold tabular-nums text-white">{team.lastSos ? `${team.lastSos.toFixed(2)}x` : "—"}</div>
              </div>
              <div className="rounded-md bg-court-elevated p-3">
                <Crown className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-zinc-500">Top study</div>
                <div className="truncate font-semibold tabular-nums text-white">{team.topStudy?.studyRating ?? "—"}</div>
              </div>
              <div className="rounded-md bg-court-elevated p-3">
                <Medal className="h-4 w-4 text-amber-200" aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-zinc-500">Top build</div>
                <div className="truncate font-semibold tabular-nums text-white">{team.topBuild?.buildRating ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="p-4">
            <h3 className="mb-3 text-sm font-medium text-zinc-500">Roster · {team.members.length} students</h3>
            <ul className="space-y-2" aria-label={`${team.name || `Team ${team.designation}`} roster`}>
              {team.members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/profile/${member.id}`}
                    className="flex items-center gap-3 rounded-md p-2.5 transition-colors hover:bg-court-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  >
                    <Avatar name={member.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-white">{member.name}</span>
                      <span className="block text-xs text-zinc-500">Grade {member.grade}</span>
                    </span>
                    <ReadinessBadge value={member.readinessScore} status={member.readinessStatus} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}

function UsersEmptyState() {
  return (
    <>
      <h2 className="text-xl font-semibold text-white">No teams configured</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">An admin can create the first team from Manage teams, then assign students to it.</p>
    </>
  );
}
