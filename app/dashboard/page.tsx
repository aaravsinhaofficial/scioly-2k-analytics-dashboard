import Link from "next/link";
import { ActivityPanel } from "@/components/dashboard/ActivityPanel";
import { RosterTable } from "@/components/dashboard/RosterTable";
import { TeamMiniPanel } from "@/components/dashboard/TeamMiniPanel";
import { QuickPointLogForm } from "@/components/forms/QuickPointLogForm";
import { AppShell } from "@/components/layout/AppShell";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import { StatTile } from "@/components/StatTile";
import { getDashboardData } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import { readinessExplanation } from "@/lib/readiness";
import { DashboardSearch } from "@/components/search/DashboardSearch";
import { TournamentInsightsPanel } from "@/components/dashboard/TournamentInsightsPanel";

export default async function DashboardPage() {
  const { currentUser, schoolName, players, activePlayers, teams, tournamentInsights } = await getDashboardData();
  const scoredPlayers = players.filter((player) => player.readinessScore > 0);
  const averageReadiness = scoredPlayers.reduce((total, player) => total + player.readinessScore, 0) / Math.max(1, scoredPlayers.length);
  const totalTournaments = players.reduce((total, player) => total + player.tournamentsAttended, 0);
  const firstName = currentUser.name.split(" ")[0];
  const currentPlayer = players.find((player) => player.id === currentUser.id);

  return (
    <AppShell currentUser={currentUser} schoolName={schoolName}>
      <div className="space-y-7">
        <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-300">{schoolName}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 md:text-base">
              Track your team, log practice, and see where everyone stands.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentUser.role === "admin" ? (
              <Link href="/admin/reports" className="inline-flex min-h-10 items-center rounded-md border border-court-line bg-court-panel px-3 text-sm font-medium text-zinc-600 transition-colors hover:border-cyan-400 hover:text-white">
                Generate report
              </Link>
            ) : null}
            <div className="rounded-full border border-court-line bg-court-panel px-3 py-1.5 text-xs font-medium capitalize text-zinc-600 shadow-sm">
              {currentUser.role} access
            </div>
          </div>
        </section>

        <DashboardSearch />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile href="/points#submission-history" linkLabel="Review your practice" label="Your recent preparation" value={formatNumber(currentPlayer?.thirtyDayPoints ?? 0)} detail="Approved practice · last 30 days" />
          <StatTile href="/points#submission-history" linkLabel="Review submissions" label="Awaiting approval" value={formatNumber(currentPlayer?.pendingPracticePoints ?? 0)} detail="Your submitted practice points" />
          <StatTile href="#team-roster" linkLabel="View team standings" label="Team readiness" value={<ReadinessBadge value={averageReadiness} size="sm" showLabel />} detail={`${scoredPlayers.length} of ${players.length} students have evidence`} />
          <StatTile href="/teams" linkLabel="Open team rosters" label="Active students" value={players.length} detail={`${formatNumber(totalTournaments)} recorded competition starts`} />
        </section>

        <section className="grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3" aria-label="Your practice and team activity">
          <div id="quick-point-log" className="min-w-0 scroll-mt-24"><QuickPointLogForm currentUser={currentUser} /></div>
          <ActivityPanel players={activePlayers} />
          <TeamMiniPanel teams={teams} />
        </section>

        <details className="rounded-md border border-court-line bg-court-panel shadow-sm">
          <summary className="flex cursor-pointer items-center px-4 py-3 text-sm font-medium text-white">How readiness is calculated</summary>
          <div className="border-t border-court-line px-4 py-3 text-sm leading-6 text-zinc-500">{readinessExplanation()} Practice alone never creates a readiness score.</div>
        </details>

        <RosterTable players={players} />

        <TournamentInsightsPanel insights={tournamentInsights} />

      </div>
    </AppShell>
  );
}
