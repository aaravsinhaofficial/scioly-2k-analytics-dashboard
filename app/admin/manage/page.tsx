import { AccountManager } from "@/components/admin/AccountManager";
import { AdminManageTabs } from "@/components/admin/AdminManageTabs";
import { CustomCategoryManager } from "@/components/admin/CustomCategoryManager";
import { RosterManager } from "@/components/admin/RosterManager";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getManagePageData } from "@/lib/data";

export default async function ManagePage() {
  const { currentUser, rosters, students } = await getManagePageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader label="Admin tools" title="Manage team" description="Update roster assignments, practice categories, accounts, roles, grades, and event profiles. Changes are recorded in the audit log." />
        <AdminManageTabs
          roster={<RosterManager rosters={rosters} />}
          categories={<CustomCategoryManager />}
          accounts={<AccountManager students={students} />}
        />
      </div>
    </AppShell>
  );
}
