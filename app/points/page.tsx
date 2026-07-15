import Link from "next/link";
import { QuickPointLogForm } from "@/components/forms/QuickPointLogForm";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PointHistoryTable } from "@/components/points/PointHistoryTable";
import { StatTile } from "@/components/StatTile";
import { getPointsPageData } from "@/lib/data";
import { formatNumber } from "@/lib/utils";

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
          actions={currentUser.role === "admin" ? (
            <Link href="/admin/manage?tab=points" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
              Manage all point logs
            </Link>
          ) : undefined}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile href="#submission-history" label="Approved · 30 days" value={formatNumber(player.thirtyDayPoints)} detail="Used in your preparation score" />
          <StatTile href="#submission-history" label="Awaiting approval" value={formatNumber(player.pendingPracticePoints)} detail="Submitted but not counted yet" />
          <StatTile href="#submission-history" label="Approved practice · all time" value={formatNumber(player.approvedPracticePoints)} />
          <StatTile href={`/profile/${currentUser.id}`} linkLabel="Open your profile" label="Competition points" value={formatNumber(player.competitionPoints)} detail="Kept separate from practice" />
        </section>

        <section className="grid items-start gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div data-tour="points-form"><QuickPointLogForm currentUser={currentUser} /></div>

          <div id="submission-history" className="scroll-mt-24 overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm">
            <div className="border-b border-court-line p-5">
              <h2 className="text-xl font-semibold text-white">Your submission history</h2>
              <p className="mt-1 text-sm text-zinc-500">Pending entries can be reviewed by an officer. Rejected entries include the review note when available.</p>
            </div>
            <PointHistoryTable
              rows={player.pointHistory}
              canWithdrawPending
              canRemoveAny={currentUser.role === "admin"}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
