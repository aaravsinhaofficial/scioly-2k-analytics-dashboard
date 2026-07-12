import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PracticeLibrary } from "@/components/practice/PracticeLibrary";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getAllPracticeQuestions, getAllPracticeTests } from "@/lib/resource-data";

export default async function PracticePage() {
  const currentUser = await getCurrentUser();
  const questions = getAllPracticeQuestions();
  const tests = getAllPracticeTests();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Preparation"
          title="Practice library"
          description="Find questions and practice tests across all active events. Open an event to see answers, explanations, and related resources."
        />
        <section className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Questions" value={questions.length} detail="Topic checks" />
          <StatTile label="Practice tests" value={tests.length} detail="Mini, full, and testoff sets" />
          <StatTile label="Events covered" value={new Set(questions.map((question) => question.eventSlug)).size} detail="Active event libraries" />
        </section>

        <PracticeLibrary questions={questions} tests={tests} />
      </div>
    </AppShell>
  );
}
