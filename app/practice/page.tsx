import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PracticeLibrary } from "@/components/practice/PracticeLibrary";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getLibraryEvents } from "@/lib/library-data";
import { getAllPracticeQuestions, getAllPracticeTests } from "@/lib/resource-data";

export default async function PracticePage() {
  const [currentUser, events] = await Promise.all([getCurrentUser(), getLibraryEvents()]);
  const questions = getAllPracticeQuestions(events);
  const tests = getAllPracticeTests(events);
  const canManage = currentUser.role === "officer" || currentUser.role === "admin";

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Preparation"
          title="Practice library"
          description="Filter the full official 2027 slate and open ten original, printable practice tests for every non-build scored event and featured trial. Officer-published interactive tests remain available alongside them."
          actions={canManage ? (
            <Link href="/admin/library" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
              Manage practice library
            </Link>
          ) : undefined}
        />
        <section className="grid gap-3 sm:grid-cols-3">
          <StatTile href="#practice-library" label="Questions" value={questions.length} detail="Topic checks" />
          <StatTile href="#practice-library" label="Practice tests" value={tests.length} detail="Mini, full, and testoff sets" />
          <StatTile href="/resources" linkLabel="Open event libraries" label="Available event filters" value={events.length} detail="Full 2027 slate plus team libraries" />
        </section>

        <PracticeLibrary questions={questions} tests={tests} eventNames={events.map((event) => event.name)} canManage={canManage} />
      </div>
    </AppShell>
  );
}
