import { ApprovalQueue } from "@/components/admin/ApprovalQueue";
import { AppShell } from "@/components/layout/AppShell";
import { getApprovePageData } from "@/lib/data";

export default async function ApprovePage() {
  const { currentUser, queue } = await getApprovePageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">Officer Tools</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-5xl">
            Point Approval
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Approvals trigger point totals, OVR recalculation, notifications, and audit records when connected to
            Supabase.
          </p>
        </section>
        <ApprovalQueue queue={queue} />
      </div>
    </AppShell>
  );
}
