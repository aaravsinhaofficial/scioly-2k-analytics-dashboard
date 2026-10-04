import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResourceDirectory } from "@/components/resources/ResourceDirectory";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getLibraryEvents } from "@/lib/library-data";
import { getFeaturedResources, getResourceStats, resourceAnnouncements } from "@/lib/resource-data";
import { searchAnchor } from "@/lib/search-utils";
import { roleMeets } from "@/lib/utils";

export default async function ResourcesPage() {
  const [currentUser, events] = await Promise.all([getCurrentUser(), getLibraryEvents()]);
  const stats = getResourceStats(events);
  const featuredResources = getFeaturedResources(events);

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Preparation"
          title="Event resources"
          description="Open any official 2027 Division C event for a focused study path and vetted links. Every non-build event also includes ten original practice tests, and featured trials are clearly labeled."
          actions={(
            <div className="flex flex-wrap gap-2">
              <Link href="/flashcards" className="inline-flex min-h-11 items-center justify-center rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white">Team flashcards</Link>
              <a href="https://www.soinc.org/rules-2027" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white">2027 rules ↗</a>
              <a href="https://www.soinc.org/events/rules-corrections" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white">Corrections ↗</a>
              {roleMeets(currentUser.role, "officer") ? (
                <Link href="/admin/library" className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
                  Manage library
                </Link>
              ) : null}
            </div>
          )}
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile href="#resource-directory" label="Event libraries" value={stats.events} detail={`${stats.scoredEvents} scored + ${stats.trials} trial${stats.teamLibraries ? ` + ${stats.teamLibraries} team archive` : ""}`} />
          <StatTile href="#resource-directory" label="Vetted resources" value={stats.resources} detail="Real external study material" />
          <StatTile href="/practice" linkLabel="Browse practice" label="Practice questions" value={stats.questions} detail="With answers and explanations" />
          <StatTile href="/practice" linkLabel="Browse tests" label="Practice tests" value={stats.tests} detail="Mini, full, and testoff sets" />
        </section>

        <ResourceDirectory events={events} />

        {featuredResources.length ? (
          <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Team picks</h2>
              <p className="mt-1 text-sm text-zinc-500">Resources your officers marked as the best starting points.</p>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {featuredResources.map((resource) => (
                <Link
                  key={`${resource.eventSlug}-${resource.title}`}
                  href={`/resources/${resource.eventSlug}#resource-${searchAnchor(resource.title)}`}
                  className="rounded-md border border-court-line p-4 transition-colors hover:border-cyan-400 hover:bg-court-elevated"
                >
                  <div className="text-xs font-medium text-cyan-300">{resource.eventName}</div>
                  <div className="mt-1 font-semibold text-white">{resource.title}</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{resource.description}</p>
                  <div className="mt-3 text-xs text-zinc-500">{resource.type} · {resource.topic} · {resource.difficulty}</div>
                  <div className="mt-3 text-sm font-medium text-cyan-300">Open in {resource.eventName} →</div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold text-white">Using the resource library</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {resourceAnnouncements.map((item) => (
              <div key={item.title} className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm">
                <div className="text-xs font-medium text-cyan-300">{item.label}</div>
                <div className="mt-1 font-semibold text-white">{item.title}</div>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
