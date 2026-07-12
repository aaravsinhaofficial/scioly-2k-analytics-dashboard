import { QuickPointLogForm } from "@/components/forms/QuickPointLogForm";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { StatusBadge } from "@/components/StatusBadge";
import { getPointsPageData } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PointsPage() {
  const { currentUser, player } = await getPointsPageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Available to every team member"
          title="Log practice points"
          description="Submit your own study, testing, build, or custom practice. Officers review every entry before it affects your approved preparation total. Officers and admins use this same page for their own work."
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Approved · 30 days" value={formatNumber(player.thirtyDayPoints)} detail="Used in your preparation score" />
          <StatTile label="Awaiting approval" value={formatNumber(player.pendingPracticePoints)} detail="Submitted but not counted yet" />
          <StatTile label="Approved practice · all time" value={formatNumber(player.approvedPracticePoints)} />
          <StatTile label="Competition points" value={formatNumber(player.competitionPoints)} detail="Kept separate from practice" />
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div data-tour="points-form"><QuickPointLogForm currentUser={currentUser} /></div>

          <div className="overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm">
            <div className="border-b border-court-line p-5">
              <h2 className="text-xl font-semibold text-white">Your submission history</h2>
              <p className="mt-1 text-sm text-zinc-500">Pending entries can be reviewed by an officer. Rejected entries include the review note when available.</p>
            </div>
            {player.pointHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                  <thead className="bg-court-elevated text-xs font-medium text-zinc-500">
                    <tr><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3 text-right">Points</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Review</th></tr>
                  </thead>
                  <tbody>
                    {player.pointHistory.map((row) => (
                      <tr key={row.id} className="border-t border-court-line">
                        <td className="px-4 py-3 text-zinc-500">{formatDate(row.date)}</td>
                        <td className="px-4 py-3 font-medium text-white">{row.activity}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">{formatNumber(row.points)}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="max-w-64 px-4 py-3 text-zinc-500">{row.approvedBy ?? row.notes ?? "Not reviewed yet"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center"><p className="font-medium text-white">No practice submitted yet</p><p className="mt-1 text-sm text-zinc-500">Your first submission will appear here.</p></div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
