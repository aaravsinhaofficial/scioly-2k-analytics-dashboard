import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { OvrBadge } from "@/components/OvrBadge";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getSciolyEvent, sciolyEvents } from "@/lib/resource-data";

export function generateStaticParams() {
  return sciolyEvents.map((event) => ({ slug: event.slug }));
}

export default async function ResourceEventPage({ params }: { params: { slug: string } }) {
  const currentUser = await getCurrentUser();
  const event = getSciolyEvent(params.slug);

  if (!event) notFound();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <Link href="/resources" className="inline-flex text-xs font-black uppercase text-cyan-300 hover:text-white">
          ← Back to resource board
        </Link>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-court-line bg-court-panel p-5 shadow-panel md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-4xl">
                <div className="text-xs font-black uppercase tracking-wide text-cyan-300">{event.category} Event Hub</div>
                <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-6xl">
                  {event.name}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">{event.description}</p>
              </div>
              <OvrBadge value={event.resourceOvr} showTier />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <StatTile label="Resource OVR" value={event.resourceOvr} detail={event.readiness} />
              <StatTile label="Resources" value={event.resources.length} detail="Notes + guides" />
              <StatTile label="Practice Qs" value={event.questions.length} detail="Topic checks" />
              <StatTile label="Tests" value={event.tests.length} detail="Mini/full sets" />
            </div>
          </div>

          <div className="rounded-md border border-court-line bg-court-panel p-5">
            <div className="text-xs font-black uppercase text-cyan-300">Event Lead</div>
            <h2 className="mt-2 text-2xl font-black italic uppercase text-white">{event.lead}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{event.tagline}</p>
            <div className="mt-5 rounded-md border border-court-line bg-court-elevated p-4">
              <div className="text-[11px] font-black uppercase text-zinc-500">Officer Control</div>
              <p className="mt-2 text-sm text-zinc-300">
                Later this connects to upload approval, pinned resources, and event-leader editing.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[400px_1fr]">
          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-xs font-black uppercase text-cyan-300">Starter Path</div>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Where To Start</h2>
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
            <div className="text-xs font-black uppercase text-cyan-300">Topic Map</div>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Scouting Report</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {event.topics.map((topic) => (
                <span key={topic} className="rounded-md border border-court-line bg-court-elevated px-3 py-2 text-xs font-black uppercase text-zinc-300">
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-md border border-cyan-400/30 bg-cyan-400/10 p-4">
              <div className="text-xs font-black uppercase text-cyan-300">High-impact rule</div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                If a resource does not help a member start, practice, or test better, it should not be pinned. The hub
                is a curated playbook, not a dumping ground.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">Resource Locker</div>
          <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Notes, Guides, Cheat Sheets</h2>
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
            <div className="text-xs font-black uppercase text-cyan-300">Practice Queue</div>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Questions</h2>
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
            <div className="text-xs font-black uppercase text-cyan-300">Test Bank</div>
            <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Mini + Full Tests</h2>
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
                  <button className="mt-5 w-full rounded-md bg-white px-4 py-3 text-sm font-black uppercase text-black transition hover:bg-zinc-200">
                    Upload PDF Later
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
