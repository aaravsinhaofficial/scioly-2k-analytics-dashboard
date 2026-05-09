import { ActivityPanel } from "@/components/dashboard/ActivityPanel";
import { RosterTable } from "@/components/dashboard/RosterTable";
import { TeamMiniPanel } from "@/components/dashboard/TeamMiniPanel";
import { QuickPointLogForm } from "@/components/forms/QuickPointLogForm";
import { AppShell } from "@/components/layout/AppShell";
import { OvrBadge } from "@/components/OvrBadge";
import { StatTile } from "@/components/StatTile";
import { getDashboardData } from "@/lib/data";
import { formatNumber } from "@/lib/utils";

export default async function DashboardPage() {
  const { currentUser, schoolName, players, activePlayers, teams } = await getDashboardData();
  const averageOvr = players.reduce((total, player) => total + player.ovrRating, 0) / players.length;
  const totalPoints = players.reduce((total, player) => total + player.totalPoints, 0);
  const totalTournaments = players.reduce((total, player) => total + player.tournamentsAttended, 0);

  return (
    <AppShell currentUser={currentUser} schoolName={schoolName}>
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase text-cyan-300">Obra D Tompkins High School</div>
              <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-6xl">
                Analytics Dashboard
              </h1>
              <p className="mt-4 text-base text-zinc-400">
                OVR blends tournament placements, Scio.ly-style strength of schedule, and approved practice effort into
                a single 60-99 rating.
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <StatTile label="Team Average OVR" value={<OvrBadge value={averageOvr} size="sm" showTier />} />
              <StatTile label="Approved Points" value={formatNumber(totalPoints)} detail="All-time roster grind" />
              <StatTile label="Competition Entries" value={formatNumber(totalTournaments)} detail="Unique tournament starts" />
            </div>

            <div className="mt-4 rounded-md border border-court-line bg-court-elevated p-4">
              <div className="text-xs font-black uppercase text-zinc-500">Current Rating Formula</div>
              <div className="mt-2 text-sm font-bold text-zinc-200">
                Placement Score = (100 - rank) x SOS x Benchmark Relative Difficulty
              </div>
              <div className="mt-2 text-sm text-zinc-400">
                If no national benchmark school appears in the field, the importer compares the field Elo to the closest
                equivalent benchmark before calculating OVR.
              </div>
            </div>
          </div>

          <QuickPointLogForm currentUser={currentUser} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <RosterTable players={players} />
          <div className="space-y-4">
            <ActivityPanel players={activePlayers} />
            <TeamMiniPanel teams={teams} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
