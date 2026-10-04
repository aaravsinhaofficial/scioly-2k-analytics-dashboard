import { ClipboardList, Scale, Trophy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { TestoffRankings } from "@/components/testoffs/TestoffRankings";
import { getCurrentUser } from "@/lib/data";
import { loadTestoffDashboardData, rankOnlyTestoffDashboard } from "@/lib/testoff-data";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TestoffsPage({
  searchParams
}: {
  searchParams: Promise<{ season?: string; event?: string }>;
}) {
  const search = await searchParams;
  const initialSeasonId = Number(search.season);
  const initialEventId = Number(search.event);
  const currentUser = await getCurrentUser();
  const data = rankOnlyTestoffDashboard(await loadTestoffDashboardData());
  const selectedSeasonId = data.activeSeasonId ?? data.eventRankings[0]?.seasonId;
  const currentGroups = data.eventRankings.filter((group) => group.seasonId === selectedSeasonId);
  const sessionCount = currentGroups.reduce((sum, group) => sum + group.sessions.length, 0);
  const rankedStudents = new Set(
    currentGroups.flatMap((group) => group.rankings.map((ranking) => ranking.studentId))
  ).size;

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Team selection"
          title="Testoff rankings"
          description="Compare rank order within each event. Exact testoff scores remain restricted to officers."
          actions={roleMeets(currentUser.role, "officer") ? (
            <Link href="/admin/testoffs" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
              Enter testoff scores
            </Link>
          ) : undefined}
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <StatTile href="#testoff-rankings" label="Active events" value={currentGroups.length} detail="With testoff data" />
          <StatTile href="#testoff-rankings" label="Sessions" value={sessionCount} detail="In the selected season" />
          <StatTile href="#testoff-rankings" label="Ranked students" value={rankedStudents} detail="Unique candidates" />
        </section>

        <details className="group rounded-md border border-court-line bg-court-panel shadow-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-white">
            <Scale className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            How rankings are calculated
          </summary>
          <div className="grid gap-3 border-t border-court-line p-4 text-sm leading-6 text-zinc-500 md:grid-cols-2">
            <div className="flex gap-3 rounded-md bg-court-elevated p-3">
              <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              Officers enter testoff results through the protected score-entry page.
            </div>
            <div className="flex gap-3 rounded-md bg-court-elevated p-3">
              <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              Team members see rank order only; raw and normalized scores stay private.
            </div>
          </div>
        </details>

        <TestoffRankings
          data={data}
          canManage={roleMeets(currentUser.role, "officer")}
          initialSeasonId={Number.isInteger(initialSeasonId) && initialSeasonId > 0 ? initialSeasonId : undefined}
          initialEventId={Number.isInteger(initialEventId) && initialEventId > 0 ? initialEventId : undefined}
        />
      </div>
    </AppShell>
  );
}
import Link from "next/link";
