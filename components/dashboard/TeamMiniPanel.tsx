import Link from "next/link";
import { ChevronDown, Users } from "lucide-react";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import type { TeamComparison } from "@/lib/types";

interface TeamMiniPanelProps {
  teams: TeamComparison[];
}

export function TeamMiniPanel({ teams }: TeamMiniPanelProps) {
  return (
    <details open className="group/disclosure overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm" aria-labelledby="team-summary-heading">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-4 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400">
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
          <h2 id="team-summary-heading" className="text-lg font-semibold text-white">Team overview</h2>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open/disclosure:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-court-line p-4">
        <div className="mb-3 flex justify-end">
          <Link href="/teams" className="text-sm font-medium text-cyan-300 hover:text-white">
            View all teams →
          </Link>
        </div>
        <ul className="grid gap-3">
          {teams.map((team) => (
            <li key={team.id} className="rounded-md bg-court-elevated p-3">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/teams?team=${encodeURIComponent(team.designation)}`} className="group min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  <div className="truncate text-xs font-medium text-zinc-500">{team.name || `Team ${team.designation}`}</div>
                  <div className="font-semibold text-white group-hover:text-cyan-300">{team.members.length} members →</div>
                </Link>
                <ReadinessBadge value={team.teamReadiness} size="sm" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="font-medium text-zinc-500">Top study</div>
                  {team.topStudy ? <Link href={`/profile/${team.topStudy.id}`} className="block truncate text-white hover:text-cyan-300">{team.topStudy.name}</Link> : <div className="truncate text-zinc-500">No data yet</div>}
                </div>
                <div>
                  <div className="font-medium text-zinc-500">Top build</div>
                  {team.topBuild ? <Link href={`/profile/${team.topBuild.id}`} className="block truncate text-white hover:text-cyan-300">{team.topBuild.name}</Link> : <div className="truncate text-zinc-500">No data yet</div>}
                </div>
              </div>
            </li>
          ))}
          {teams.length === 0 ? <li className="rounded-md border border-dashed border-court-line p-4 text-sm text-zinc-500">No teams have been configured yet.</li> : null}
        </ul>
      </div>
    </details>
  );
}
