"use client";

import Link from "next/link";
import { Crown, Gauge, Medal } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import type { TeamComparison } from "@/lib/types";

interface TeamComparisonViewProps {
  teams: TeamComparison[];
}

export function TeamComparisonView({ teams }: TeamComparisonViewProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");
  const [compare, setCompare] = useState(false);
  const visibleTeams = compare ? teams : teams.filter((team) => team.id === selectedTeamId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-court-line bg-court-panel p-2 shadow-sm" role="tablist" aria-label="Choose team view">
        {teams.map((team) => (
          <button key={team.id} type="button" onClick={() => { setSelectedTeamId(team.id); setCompare(false); }} className={`rounded-md px-4 text-sm font-medium ${!compare && selectedTeamId === team.id ? "bg-white text-black" : "text-zinc-600 hover:bg-court-elevated"}`} role="tab" aria-selected={!compare && selectedTeamId === team.id}>Team {team.designation}</button>
        ))}
        <button type="button" onClick={() => setCompare(true)} className={`rounded-md px-4 text-sm font-medium ${compare ? "bg-white text-black" : "text-zinc-600 hover:bg-court-elevated"}`} role="tab" aria-selected={compare}>Compare all</button>
      </div>
      <div className={`grid gap-4 ${compare ? "xl:grid-cols-3" : "max-w-3xl"}`}>
      {visibleTeams.map((team) => (
        <section key={team.id} className="overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm">
          <div className="border-b border-court-line p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-zinc-500">{team.schoolName}</div>
                <h2 className="mt-1 text-2xl font-semibold text-white">Team {team.designation}</h2>
              </div>
              <ReadinessBadge value={team.teamReadiness} size="md" showLabel />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-court-elevated p-3">
                <Gauge className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-zinc-500">Latest SOS</div>
                <div className="font-semibold tabular-nums text-white">{team.lastSos ? `${team.lastSos.toFixed(2)}x` : "—"}</div>
              </div>
              <div className="rounded-md bg-court-elevated p-3">
                <Crown className="h-4 w-4 text-pink-300" aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-zinc-500">Top study</div>
                <div className="truncate font-semibold tabular-nums text-white">{team.topStudy?.studyRating ?? "—"}</div>
              </div>
              <div className="rounded-md bg-court-elevated p-3">
                <Medal className="h-4 w-4 text-purple-300" aria-hidden="true" />
                <div className="mt-2 text-xs font-medium text-zinc-500">Top build</div>
                <div className="truncate font-semibold tabular-nums text-white">{team.topBuild?.buildRating ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 text-sm font-medium text-zinc-500">Roster · {team.members.length} students</div>
            <div className="space-y-2">
              {team.members.map((member) => (
                <Link
                  key={member.id}
                  href={`/profile/${member.id}`}
                  className="flex items-center gap-3 rounded-md p-2.5 transition-colors hover:bg-court-elevated"
                >
                  <Avatar name={member.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{member.name}</div>
                    <div className="text-xs text-zinc-500">Grade {member.grade}</div>
                  </div>
                  <ReadinessBadge value={member.readinessScore} status={member.readinessStatus} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
      </div>
    </div>
  );
}
