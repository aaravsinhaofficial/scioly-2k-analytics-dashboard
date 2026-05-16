import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
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
        <section className="rounded-md border border-court-line bg-court-panel p-5 shadow-panel md:p-6">
          <div className="text-xs font-black uppercase tracking-wide text-cyan-300">Practice Center</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-6xl">
            Question + Test Bank
          </h1>
          <p className="mt-4 max-w-3xl text-base text-zinc-400">
            Team-wide access to practice items. Serious prep should still route back to the relevant event hub so
            members see starter guides and resources in context.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <StatTile label="Questions" value={questions.length} detail="Topic checks" />
            <StatTile label="Practice Tests" value={tests.length} detail="Mini/full/testoff" />
            <StatTile label="Events Covered" value={new Set(questions.map((question) => question.eventSlug)).size} detail="Active hubs" />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-xs font-black uppercase text-cyan-300">Question Queue</div>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Topic Practice</h2>
            <div className="mt-5 space-y-4">
              {questions.map((question) => (
                <Link
                  key={`${question.eventSlug}-${question.question}`}
                  href={`/resources/${question.eventSlug}`}
                  className="block rounded-md border border-court-line bg-court-elevated p-4 transition hover:border-cyan-400/70"
                >
                  <div className="text-[11px] font-black uppercase text-cyan-300">
                    {question.eventName} / {question.topic} / {question.difficulty}
                  </div>
                  <p className="mt-2 font-black text-white">{question.question}</p>
                  <p className="mt-3 text-sm text-zinc-500">Open event hub for answer explanation →</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-xs font-black uppercase text-cyan-300">Test Bank</div>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Mini + Full Tests</h2>
            <div className="mt-5 space-y-4">
              {tests.map((test) => (
                <Link
                  key={`${test.eventSlug}-${test.title}`}
                  href={`/resources/${test.eventSlug}`}
                  className="block rounded-md border border-court-line bg-court-elevated p-4 transition hover:border-fuchsia-400/70"
                >
                  <div className="text-[11px] font-black uppercase text-fuchsia-300">
                    {test.eventName} / {test.format} / {test.difficulty}
                  </div>
                  <h3 className="mt-2 text-lg font-black text-white">{test.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{test.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
