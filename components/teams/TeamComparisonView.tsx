import Link from "next/link";
import { Crown, Gauge, Medal } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { OvrBadge } from "@/components/OvrBadge";
import type { TeamComparison } from "@/lib/types";

interface TeamComparisonViewProps {
  teams: TeamComparison[];
}

export function TeamComparisonView({ teams }: TeamComparisonViewProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {teams.map((team) => (
        <section key={team.id} className="rounded-md border border-court-line bg-court-panel">
          <div className="border-b border-court-line p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase text-zinc-500">{team.schoolName}</div>
                <h2 className="mt-1 text-3xl font-black italic uppercase text-white">Team {team.designation}</h2>
              </div>
              <OvrBadge value={team.teamOvr} size="md" showTier />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-court-line bg-court-elevated p-3">
                <Gauge className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <div className="mt-2 text-[10px] font-black uppercase text-zinc-500">Last SOS</div>
                <div className="font-black text-white">{team.lastSos ? `${team.lastSos.toFixed(2)}x` : "N/A"}</div>
              </div>
              <div className="rounded-md border border-court-line bg-court-elevated p-3">
                <Crown className="h-4 w-4 text-pink-300" aria-hidden="true" />
                <div className="mt-2 text-[10px] font-black uppercase text-zinc-500">Study</div>
                <div className="truncate font-black text-white">{team.topStudy?.studyRating ?? "N/A"}</div>
              </div>
              <div className="rounded-md border border-court-line bg-court-elevated p-3">
                <Medal className="h-4 w-4 text-purple-300" aria-hidden="true" />
                <div className="mt-2 text-[10px] font-black uppercase text-zinc-500">Build</div>
                <div className="truncate font-black text-white">{team.topBuild?.buildRating ?? "N/A"}</div>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 text-xs font-black uppercase text-zinc-500">Roster</div>
            <div className="space-y-2">
              {team.members.map((member) => (
                <Link
                  key={member.id}
                  href={`/profile/${member.id}`}
                  className="flex items-center gap-3 rounded-md border border-court-line bg-court-elevated p-3 transition hover:border-cyan-400/60"
                >
                  <Avatar name={member.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-white">{member.name}</div>
                    <div className="text-xs font-bold uppercase text-zinc-500">Grade {member.grade}</div>
                  </div>
                  <OvrBadge value={member.ovrRating} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
