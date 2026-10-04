import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getLibraryEvent } from "@/lib/library-data";
import { sciolyEvents } from "@/lib/resource-data";
import { searchAnchor } from "@/lib/search-utils";
import { roleMeets } from "@/lib/utils";

export function generateStaticParams() {
  return sciolyEvents.map((event) => ({ slug: event.slug }));
}

export default async function ResourceEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [currentUser, event] = await Promise.all([getCurrentUser(), getLibraryEvent(slug)]);

  if (!event) notFound();
  const representedTopics = new Set(event.resources.map((resource) => resource.topic));
  const coveredTopicCount = event.topics.filter((topic) => representedTopics.has(topic)).length;

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <Link href="/resources" className="inline-flex text-sm font-medium text-cyan-300 hover:text-white">
          ← Back to event resources
        </Link>

        <PageHeader
          label={`${event.category} event · ${event.season && event.rulesStatus ? `${event.season} ${event.rulesStatus.toLowerCase()} scope` : "Team library"}${event.isTrial ? " · Featured trial" : ""}`}
          title={event.name}
          description={event.description}
          actions={(
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex min-h-11 items-center rounded-md border border-court-line bg-court-panel px-3 py-2 text-sm font-semibold text-white">{event.resources.length} vetted resource{event.resources.length === 1 ? "" : "s"}</span>
              {roleMeets(currentUser.role, "officer") ? (
                <Link href={`/admin/library?event=${encodeURIComponent(event.slug)}`} className="inline-flex min-h-11 items-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Manage library</Link>
              ) : null}
            </div>
          )}
        />

        {event.isTrial ? (
          <section className="rounded-md border border-amber-300/40 bg-amber-300/10 p-4 sm:p-5">
            <div className="text-sm font-semibold text-amber-200">Featured trial — confirm your tournament offers it</div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {event.name} appears in the 2027 manual as a featured trial rather than one of the 23 scored national events. Use this library when your invitational, regional, or state schedule includes it.
            </p>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile href="#topics" label="Topics represented" value={`${coveredTopicCount}/${event.topics.length}`} detail="Backed by a named resource" />
          <StatTile href="#resources" label="Vetted resources" value={event.resources.length} detail="External links and team guides" />
          <StatTile href="#questions" label="Practice questions" value={event.questions.length} detail="Topic checks" />
          <StatTile href="#tests" label="Tests" value={event.tests.length} detail="Mini and full sets" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[400px_1fr]">
          <div id="topics" className="scroll-mt-24 rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Starter path</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Where to start</h2>
            <div className="mt-5 space-y-3">
              {event.starterPath.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-cyan-400/60 bg-cyan-400/10 text-sm font-black text-cyan-300">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-zinc-600">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Topics</div>
            <h2 className="mt-1 text-xl font-semibold text-white">What to study</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {event.topics.map((topic) => (
                <span key={topic} className="rounded-md border border-court-line bg-court-elevated px-3 py-2 text-xs font-black uppercase text-zinc-600">
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-md border border-cyan-400/30 bg-cyan-400/10 p-4">
              <div className="text-sm font-medium text-cyan-300">Keep it useful</div>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                If a resource does not help a member start, practice, or test better, it should not be pinned. The hub
                is a curated playbook, not a dumping ground.
              </p>
            </div>
          </div>
        </section>

        <section id="resources" className="scroll-mt-24 rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-sm font-medium text-cyan-300">Resources</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Vetted links and team guides</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {event.resources.map((resource) => (
              <article id={`resource-${searchAnchor(resource.title)}`} key={resource.title} className="min-w-0 scroll-mt-24 rounded-md border border-court-line bg-court-elevated p-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-court-control bg-court-panel px-2 py-1 text-xs font-medium text-zinc-600">
                    {resource.type}
                  </span>
                  <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-300">
                    {resource.difficulty}
                  </span>
                  {resource.recommended && (
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-300">
                      Featured
                    </span>
                  )}
                </div>
                <h3 className="mt-4 break-words text-lg font-semibold text-white">{resource.title}</h3>
                <div className="mt-2 text-xs font-medium text-cyan-300">{resource.topic}</div>
                <p className="mt-3 break-words text-sm leading-6 text-zinc-600">{resource.description}</p>
                {resource.body ? (
                  <details className="mt-4 rounded-md border border-court-control bg-court-panel">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-white">Read guide text</summary>
                    <div className="whitespace-pre-wrap break-words border-t border-court-line p-3 text-sm leading-6 text-zinc-600">{resource.body}</div>
                  </details>
                ) : null}
                {resource.url ? (
                  <a href={resource.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Open resource ↗</a>
                ) : null}
              </article>
            ))}
            {event.resources.length === 0 ? (
              <div className="col-span-full rounded-md border border-dashed border-court-line p-6 text-center">
                <p className="font-medium text-white">No resources added yet</p>
                <p className="mt-1 text-sm text-zinc-500">An officer can add the first guide, link, or cheat sheet from Manage library.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div id="questions" className="scroll-mt-24 rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Practice</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Questions</h2>
            <div className="mt-5 space-y-4">
              {event.questions.map((question) => (
                <article id={`question-${searchAnchor(question.question)}`} key={question.question} className="scroll-mt-24 rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="text-xs font-medium text-zinc-500">
                    {question.topic} / {question.difficulty}
                  </div>
                  <p className="mt-2 break-words font-semibold leading-6 text-white">{question.question}</p>
                  <details className="mt-4 rounded-md border border-court-control bg-court-panel">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-cyan-300">Reveal answer</summary>
                    <div className="border-t border-court-line p-4">
                      <div className="break-words text-sm font-semibold text-white">{question.answer}</div>
                      <p className="mt-2 break-words text-sm leading-6 text-zinc-600">{question.explanation}</p>
                    </div>
                  </details>
                </article>
              ))}
              {event.questions.length === 0 ? <p className="rounded-md border border-dashed border-court-line p-5 text-sm text-zinc-500">No practice questions have been added for this event yet.</p> : null}
            </div>
          </div>

          <div id="tests" className="scroll-mt-24 rounded-md border border-court-line bg-court-panel p-5 md:p-6">
            <div className="text-sm font-medium text-cyan-300">Practice</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Mini and full tests</h2>
            <div className="mt-5 space-y-4">
              {event.tests.map((test) => (
                <article id={`test-${searchAnchor(test.title)}`} key={test.title} className="scroll-mt-24 rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-md border border-court-control bg-court-panel px-2 py-1 text-xs font-medium text-zinc-600">
                      {test.format}
                    </span>
                    <span className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-xs font-medium text-cyan-300">
                      {test.difficulty}
                    </span>
                  </div>
                  <h3 className="mt-4 break-words text-lg font-semibold text-white">{test.title}</h3>
                  <p className="mt-3 break-words text-sm leading-6 text-zinc-600">{test.description}</p>
                  {test.body ? (
                    <details className="mt-4 rounded-md border border-court-control bg-court-panel">
                      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-white">Read test instructions</summary>
                      <div className="whitespace-pre-wrap break-words border-t border-court-line p-3 text-sm leading-6 text-zinc-600">{test.body}</div>
                    </details>
                  ) : null}
                  {test.url ? (
                    <a href={test.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Open practice test ↗</a>
                  ) : test.libraryId ? (
                    <Link href={`/practice/tests/${test.libraryId}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Start interactive test →</Link>
                  ) : test.testNumber ? (
                    <Link href={`/practice/${event.slug}/${test.testNumber}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Open original practice test →</Link>
                  ) : (
                    <div className="mt-4 rounded-md border border-court-line bg-court-panel px-4 py-3 text-sm text-zinc-500">No test file has been uploaded yet.</div>
                  )}
                  {test.libraryId && test.url ? <Link href={`/practice/tests/${test.libraryId}`} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white">Take on-site test →</Link> : null}
                </article>
              ))}
              {event.tests.length === 0 ? <p className="rounded-md border border-dashed border-court-line p-5 text-sm text-zinc-500">No practice tests have been added for this event yet.</p> : null}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
