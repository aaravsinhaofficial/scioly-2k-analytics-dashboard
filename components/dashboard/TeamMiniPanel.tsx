import Link from "next/link";
import { Users } from "lucide-react";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import type { TeamComparison } from "@/lib/types";

interface TeamMiniPanelProps {
  teams: TeamComparison[];
}

export function TeamMiniPanel({ teams }: TeamMiniPanelProps) {
  return (
    <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-pink-300" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-white">Teams</h2>
        </div>
        <Link href="/teams" className="text-sm font-medium text-cyan-300 hover:text-white">
          View all
        </Link>
      </div>
      <div className="grid gap-3">
        {teams.map((team) => (
          <div key={team.id} className="rounded-md bg-court-elevated p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-zinc-500">Team {team.designation}</div>
                <div className="font-semibold text-white">{team.members.length} members</div>
              </div>
              <ReadinessBadge value={team.teamReadiness} size="sm" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-medium text-zinc-500">Top study</div>
                <div className="truncate text-zinc-200">{team.topStudy?.name ?? "No data yet"}</div>
              </div>
              <div>
                <div className="font-medium text-zinc-500">Top build</div>
                <div className="truncate text-zinc-200">{team.topBuild?.name ?? "No data yet"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
