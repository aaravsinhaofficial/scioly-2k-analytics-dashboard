import Link from "next/link";
import { Users } from "lucide-react";
import { OvrBadge } from "@/components/OvrBadge";
import type { TeamComparison } from "@/lib/types";

interface TeamMiniPanelProps {
  teams: TeamComparison[];
}

export function TeamMiniPanel({ teams }: TeamMiniPanelProps) {
  return (
    <div className="rounded-md border border-court-line bg-court-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-pink-300" aria-hidden="true" />
          <h2 className="text-lg font-black italic uppercase text-white">Teams</h2>
        </div>
        <Link href="/teams" className="text-xs font-black uppercase text-cyan-300 hover:text-white">
          Compare
        </Link>
      </div>
      <div className="grid gap-3">
        {teams.map((team) => (
          <div key={team.id} className="rounded-md border border-court-line bg-court-elevated p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase text-zinc-500">Team {team.designation}</div>
                <div className="font-black text-white">{team.members.length} members</div>
              </div>
              <OvrBadge value={team.teamOvr} size="sm" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="font-black uppercase text-zinc-500">Top Study</div>
                <div className="truncate text-zinc-200">{team.topStudy?.name ?? "N/A"}</div>
              </div>
              <div>
                <div className="font-black uppercase text-zinc-500">Top Build</div>
                <div className="truncate text-zinc-200">{team.topBuild?.name ?? "N/A"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
