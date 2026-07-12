import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getSciolyEvent, sciolyEvents } from "@/lib/resource-data";

export function generateStaticParams() {
  return sciolyEvents.map((event) => ({ slug: event.slug }));
}

export default async function ResourceEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currentUser = await getCurrentUser();
  const event = getSciolyEvent(slug);

  if (!event) notFound();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <Link href="/resources" className="inline-flex text-sm font-medium text-cyan-300 hover:text-white">
          ← Back to event resources
        </Link>

        <PageHeader
          label={`${event.category} event · Lead: ${event.lead}`}
          title={event.name}
          description={event.description}
          actions={<span className="rounded-md border border-court-line bg-court-panel px-3 py-2 text-sm font-semibold text-white">{event.coverageScore}% coverage</span>}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Resource coverage" value={`${event.coverageScore}%`} detail={event.readiness} />
          <StatTile label="Resources" value={event.resources.length} detail="Notes and guides" />
          <StatTile label="Practice questions" value={event.questions.length} detail="Topic checks" />
          <StatTile label="Tests" value={event.tests.length} detail="Mini and full sets" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[400px_1fr]">
          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Starter path</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Where to start</h2>
            <div className="mt-5 space-y-3">
              {event.starterPath.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-cyan-400/60 bg-cyan-400/10 text-sm font-black text-cyan-300">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-zinc-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Topics</div>
            <h2 className="mt-1 text-xl font-semibold text-white">What to study</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {event.topics.map((topic) => (
                <span key={topic} className="rounded-md border border-court-line bg-court-elevated px-3 py-2 text-xs font-black uppercase text-zinc-300">
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-md border border-cyan-400/30 bg-cyan-400/10 p-4">
              <div className="text-sm font-medium text-cyan-300">Keep it useful</div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                If a resource does not help a member start, practice, or test better, it should not be pinned. The hub
                is a curated playbook, not a dumping ground.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-sm font-medium text-cyan-300">Resources</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Notes, guides, and cheat sheets</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {event.resources.map((resource) => (
              <article key={resource.title} className="rounded-md border border-court-line bg-court-elevated p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-court-line bg-black px-2 py-1 text-[11px] font-black uppercase text-zinc-400">
                    {resource.type}
                  </span>
                  <span className="rounded-md border border-fuchsia-400/40 bg-fuchsia-400/10 px-2 py-1 text-[11px] font-black uppercase text-fuchsia-300">
                    {resource.difficulty}
                  </span>
                  {resource.recommended && (
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[11px] font-black uppercase text-cyan-300">
                      Featured
                    </span>
                  )}
                </div>
                <h3 className="mt-4 text-xl font-black text-white">{resource.title}</h3>
                <div className="mt-2 text-[11px] font-black uppercase text-cyan-300">{resource.topic}</div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{resource.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Practice</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Questions</h2>
            <div className="mt-5 space-y-4">
              {event.questions.map((question) => (
                <article key={question.question} className="rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="text-[11px] font-black uppercase text-zinc-500">
                    {question.topic} / {question.difficulty}
                  </div>
                  <p className="mt-2 font-black text-white">{question.question}</p>
                  <div className="mt-4 rounded-md border border-court-line bg-black p-4">
                    <div className="text-sm font-black text-cyan-300">Answer: {question.answer}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{question.explanation}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Practice</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Mini and full tests</h2>
            <div className="mt-5 space-y-4">
              {event.tests.map((test) => (
                <article key={test.title} className="rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border border-court-line bg-black px-2 py-1 text-[11px] font-black uppercase text-zinc-400">
                      {test.format}
                    </span>
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-[11px] font-black uppercase text-cyan-300">
                      {test.difficulty}
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-black text-white">{test.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{test.description}</p>
                  <button disabled className="mt-5 w-full cursor-not-allowed rounded-md border border-court-line px-4 py-3 text-sm font-medium text-zinc-500">
                    PDF not yet available
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
