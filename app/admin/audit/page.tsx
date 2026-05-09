import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { AppShell } from "@/components/layout/AppShell";
import { getAuditPageData } from "@/lib/data";

export default async function AuditPage() {
  const { currentUser, logs } = await getAuditPageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">Admin Audit</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-5xl">
            Audit Trail
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Every elevated action is designed to be timestamped, IP logged, and reviewable by admins.
          </p>
        </section>
        <AuditLogTable logs={logs} />
      </div>
    </AppShell>
  );
}
