import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { PrintPracticeButton } from "@/components/practice/PrintPracticeButton";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getLibraryEvent } from "@/lib/library-data";
import { sciolyEvents } from "@/lib/resource-data";

export function generateStaticParams() {
  return sciolyEvents.flatMap((event) =>
    event.tests.flatMap((test) => test.testNumber
      ? [{ eventSlug: event.slug, testNumber: String(test.testNumber) }]
      : [])
  );
}

export default async function PracticeSetPage({
  params,
}: {
  params: Promise<{ eventSlug: string; testNumber: string }>;
}) {
  const { eventSlug, testNumber } = await params;
  const selectedNumber = Number(testNumber);
  const [currentUser, event] = await Promise.all([getCurrentUser(), getLibraryEvent(eventSlug)]);
  const test = event?.tests.find((item) => item.testNumber === selectedNumber);

  if (!event || !test || !test.questions?.length) notFound();

  const totalPoints = test.questions.reduce((sum, question) => sum + question.points, 0);
  const nextNumber = selectedNumber === 10 ? 1 : selectedNumber + 1;
  const answerGuide = (
    <div className="space-y-4 border-t border-court-line p-4 sm:p-6 print:border-zinc-300">
      {test.questions.map((question) => (
        <article key={question.number} className="break-inside-avoid rounded-md border border-court-line bg-court-elevated p-4 print:border-zinc-300 print:bg-white">
          <div className="text-sm font-semibold text-cyan-300 print:text-black">Question {question.number} · {question.points} points</div>
          {question.options?.length && question.correctOption !== undefined ? (
            <p className="mt-2 font-semibold text-white print:text-black">
              Correct answer: {String.fromCharCode(65 + question.correctOption)}. {question.options[question.correctOption]}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-zinc-500 print:text-black">{question.answer}</p>
        </article>
      ))}
    </div>
  );

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6 print:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/resources/${event.slug}#tests`} className="text-sm font-medium text-cyan-300 hover:text-white">
            ← Back to {event.name}
          </Link>
          <Link href={`/practice/${event.slug}/${nextNumber}`} className="text-sm font-medium text-cyan-300 hover:text-white">
            Next practice test →
          </Link>
        </div>

        <PageHeader
          label={`${event.name} · 2027 official scope`}
          title={test.title}
          description={test.description}
          actions={<PrintPracticeButton />}
        />

        <section className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
          <StatTile label="Suggested time" value={`${test.durationMinutes ?? 50} min`} detail="Use a visible timer" />
          <StatTile label="Questions" value={test.questions.length} detail="Complete every response" />
          <StatTile label="Points" value={totalPoints} detail="Score with the guide" />
        </section>

        <section className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-4 sm:p-5">
          <div className="text-sm font-semibold text-cyan-300">Original team practice material</div>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            This set summarizes skills from the current event scope without reproducing the rulebook. The official 2027 Rules Manual, national corrections and clarifications, and your tournament notices control every rule-specific decision.
          </p>
          {test.body ? <p className="mt-2 text-sm leading-6 text-zinc-500">{test.body}</p> : null}
        </section>

        <section className="rounded-md border border-court-line bg-court-panel p-4 sm:p-6 print:border-zinc-400 print:bg-white">
          <div className="flex items-end justify-between gap-4 border-b border-court-line pb-4 print:border-zinc-300">
            <div>
              <div className="text-sm font-medium text-cyan-300 print:text-black">Test booklet</div>
              <h2 className="mt-1 text-xl font-semibold text-white print:text-black">Answer every question</h2>
            </div>
            <div className="text-sm text-zinc-500 print:text-black">Name: ____________________</div>
          </div>
          <ol className="mt-5 space-y-5">
            {test.questions.map((question) => (
              <li key={question.number} className="break-inside-avoid rounded-md border border-court-line bg-court-elevated p-4 print:border-zinc-300 print:bg-white">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-cyan-400/50 bg-cyan-400/10 text-sm font-black text-cyan-300 print:border-zinc-500 print:bg-white print:text-black">
                    {question.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-7 text-white print:text-black">{question.prompt}</p>
                    <div className="mt-3 text-xs font-medium text-zinc-500 print:text-black">{question.points} points</div>
                    {question.options?.length ? (
                      <div className="mt-4 grid gap-2 text-sm leading-6 text-zinc-500 print:text-black">
                        {question.options.map((option, optionIndex) => (
                          <div key={option} className="flex gap-3 rounded-md border border-court-line px-3 py-2 print:border-zinc-300">
                            <span className="font-semibold">{String.fromCharCode(65 + optionIndex)}.</span>
                            <span>{option}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-6 h-16 border-b border-dashed border-court-control print:border-zinc-400" aria-hidden="true" />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <details className="rounded-md border border-court-line bg-court-panel print:hidden">
          <summary className="cursor-pointer px-4 py-4 font-semibold text-white">Answer and scoring guide</summary>
          {answerGuide}
        </details>

        <section className="hidden break-before-page rounded-md border border-zinc-400 bg-white print:block">
          <h2 className="px-4 py-4 text-xl font-semibold text-black">Answer and scoring guide</h2>
          {answerGuide}
        </section>
      </div>
    </AppShell>
  );
}
