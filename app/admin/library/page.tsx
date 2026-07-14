import { LibraryManager } from "@/components/admin/LibraryManager";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/data";
import { getLibraryEventOptions, getManagedLibraryItems } from "@/lib/library-data";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LibraryManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const currentUser = await getCurrentUser();
  const canModerate = roleMeets(currentUser.role, "officer");
  const [params, initialItems, events] = await Promise.all([
    searchParams,
    getManagedLibraryItems(canModerate),
    getLibraryEventOptions(),
  ]);

  return (
    <AppShell currentUser={currentUser}>
      <div className="min-w-0 space-y-6">
        <PageHeader
          label={canModerate ? "Library moderation" : "Team contribution"}
          title={canModerate ? "Manage event library" : "Add an event resource"}
          description={canModerate
            ? "Add links, guide text, practice questions, and tests to the correct event. Removed items remain restorable, and every change is recorded."
            : "Share a useful link or set of notes with the team. Officers review and manage removals."}
        />
        <LibraryManager
          initialItems={initialItems}
          events={events}
          initialEvent={params.event}
          canModerate={canModerate}
        />
      </div>
    </AppShell>
  );
}
