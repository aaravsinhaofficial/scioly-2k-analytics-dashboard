import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getLibraryEvent } from "@/lib/library-data";
import { sciolyEvents } from "@/lib/resource-data";
import { libraryContentAnchor } from "@/lib/search-utils";
import { roleMeets } from "@/lib/utils";

interface ResourceEventPageProps {
  params: Promise<{ slug: string }>;
}

const getCachedLibraryEvent = cache(getLibraryEvent);

export function generateStaticParams() {
  return sciolyEvents.map((event) => ({ slug: event.slug }));
}

export async function generateMetadata({ params }: ResourceEventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getCachedLibraryEvent(slug);
  return event
    ? { title: event.name, description: event.description }
    : { title: "Event not found" };
}

export default async function ResourceEventPage({
  params,
}: ResourceEventPageProps) {
  const { slug } = await params;
  const [currentUser, event] = await Promise.all([getCurrentUser(), getCachedLibraryEvent(slug)]);

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
              <span className="inline-flex min-h-11 items-center rounded-md border border-court-line bg-court-panel px-3 py-2 text-sm font-semibold text-white">{event.resources.length} resource{event.resources.length === 1 ? "" : "s"}</span>
              <Link href={`/admin/library?event=${encodeURIComponent(event.slug)}`} className="inline-flex min-h-11 items-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
                {roleMeets(currentUser.role, "officer") ? "Manage library" : "Add a resource"}
              </Link>
            </div>
          )}
        />

        {event.isTrial || event.rulesStatus === "Draft" ? (
          <section className={`rounded-md border p-4 sm:p-5 ${event.isTrial ? "border-amber-300/40 bg-amber-300/10" : "border-court-line bg-court-panel"}`}>
            <div className={`text-sm font-semibold ${event.isTrial ? "text-amber-200" : "text-white"}`}>
              {event.isTrial ? "Featured trial — confirm your tournament offers it" : "2027 draft-scope notice"}
            </div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {event.isTrial
                ? "Code Craze is listed separately from the 23 scored national events. Its library is available for teams whose local schedule includes the trial."
                : "The supplied Summer Workshop rules are marked draft. Use this hub to prepare, but verify final dimensions, permitted materials, and corrections on the official Science Olympiad page before competing."}
            </p>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile href="#topics" label="Topics represented" value={`${coveredTopicCount}/${event.topics.length}`} detail="Backed by a named resource" />
          <StatTile href="#resources" label="Shared resources" value={event.resources.length} detail="External links and team guides" />
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
          <h2 className="mt-1 text-xl font-semibold text-white">Links and team guides</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {event.resources.map((resource) => (
              <article id={`resource-${libraryContentAnchor(resource.title, resource.libraryId)}`} key={resource.libraryId ?? resource.title} className="min-w-0 scroll-mt-24 rounded-md border border-court-line bg-court-elevated p-4">
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
                <p className="mt-1 text-sm text-zinc-500">Any team member can add the first useful link or notes from Add a resource.</p>
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
                <article id={`question-${libraryContentAnchor(question.question, question.libraryId)}`} key={question.libraryId ?? question.question} className="scroll-mt-24 rounded-md border border-court-line bg-court-elevated p-4">
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
                <article id={`test-${libraryContentAnchor(test.title, test.libraryId)}`} key={test.libraryId ?? test.title} className="scroll-mt-24 rounded-md border border-court-line bg-court-elevated p-4">
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
