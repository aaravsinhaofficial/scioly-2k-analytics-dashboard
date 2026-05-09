import { AccountManager } from "@/components/admin/AccountManager";
import { CustomCategoryManager } from "@/components/admin/CustomCategoryManager";
import { RosterManager } from "@/components/admin/RosterManager";
import { AppShell } from "@/components/layout/AppShell";
import { getManagePageData } from "@/lib/data";

export default async function ManagePage() {
  const { currentUser, rosters, students } = await getManagePageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">Admin Tools</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-5xl">
            Roster Management
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Move students between A, B, and C teams. Production saves use optimistic versioning and write every change
            to the audit log.
          </p>
        </section>
        <RosterManager rosters={rosters} />
        <CustomCategoryManager />
        <AccountManager students={students} />
      </div>
    </AppShell>
  );
}
