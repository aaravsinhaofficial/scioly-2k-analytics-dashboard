import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { OvrBadge } from "@/components/OvrBadge";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { getFeaturedResources, getResourceStats, resourceAnnouncements, sciolyEvents } from "@/lib/resource-data";

function readinessClass(readiness: string) {
  if (readiness === "Loaded") return "border-cyan-400/60 bg-cyan-400/10 text-cyan-300";
  if (readiness === "Building") return "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300";
  return "border-red-400/50 bg-red-400/10 text-red-300";
}

export default async function ResourcesPage() {
  const currentUser = await getCurrentUser();
  const stats = getResourceStats();
  const featuredResources = getFeaturedResources();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-md border border-court-line bg-court-panel p-5 shadow-panel md:p-6">
            <div className="max-w-4xl">
              <div className="text-xs font-black uppercase tracking-wide text-cyan-300">Resource Command Center</div>
              <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-6xl">
                Event Hubs
              </h1>
              <p className="mt-4 max-w-3xl text-base text-zinc-400">
                Organize prep the way SciOly actually works: by event. Each hub holds starter paths, recommended
                resources, topic maps, practice questions, and test banks.
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <StatTile label="Resource OVR" value={<OvrBadge value={stats.averageResourceOvr} size="sm" showTier />} />
              <StatTile label="Event Hubs" value={stats.events} detail="Active modules" />
              <StatTile label="Resources" value={stats.resources} detail="Curated items" />
              <StatTile label="Practice Items" value={stats.questions + stats.tests} detail="Questions + tests" />
            </div>

            <div className="mt-4 rounded-md border border-court-line bg-court-elevated p-4">
              <div className="text-xs font-black uppercase text-zinc-500">Current Resource Formula</div>
              <div className="mt-2 text-sm font-bold text-zinc-200">
                Resource OVR = starter clarity + resource coverage + practice depth + test readiness
              </div>
              <div className="mt-2 text-sm text-zinc-400">
                Weak event pages should be treated like weak roster positions: identify gaps, assign ownership, and
                upload the highest-leverage material first.
              </div>
            </div>
          </div>

          <div className="rounded-md border border-court-line bg-court-panel p-5">
            <div className="text-xs font-black uppercase text-cyan-300">Quick Find</div>
            <h2 className="mt-2 text-2xl font-black italic uppercase text-white">Search Board</h2>
            <div className="mt-4 rounded-md border border-court-line bg-court-elevated px-4 py-3 text-sm font-bold text-zinc-500">
              Search events, topics, tests, or resources...
            </div>
            <div className="mt-5 space-y-3">
              {resourceAnnouncements.map((item) => (
                <div key={item.title} className="rounded-md border border-court-line bg-court-elevated p-4">
                  <div className="text-[11px] font-black uppercase text-cyan-300">{item.label}</div>
                  <div className="mt-1 text-sm font-black text-white">{item.title}</div>
                  <p className="mt-2 text-sm text-zinc-400">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-cyan-300">Main Board</div>
              <h2 className="mt-2 text-3xl font-black italic uppercase text-white">All Event Hubs</h2>
            </div>
            <div className="text-xs font-black uppercase text-zinc-500">Click any card for the event deep dive</div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sciolyEvents.map((event) => (
              <Link
                key={event.slug}
                href={`/resources/${event.slug}`}
                className="group rounded-md border border-court-line bg-court-elevated p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/70 hover:shadow-opal"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-black uppercase text-zinc-500">{event.category}</div>
                    <h3 className="mt-2 text-2xl font-black italic uppercase leading-none text-white">{event.name}</h3>
                  </div>
                  <OvrBadge value={event.resourceOvr} size="sm" />
                </div>
                <p className="mt-4 text-sm leading-6 text-zinc-400">{event.tagline}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black uppercase ${readinessClass(event.readiness)}`}>
                    {event.readiness}
                  </span>
                  <span className="rounded-md border border-court-line bg-black px-2.5 py-1 text-[11px] font-black uppercase text-zinc-400">
                    {event.resources.length} Resources
                  </span>
                  <span className="rounded-md border border-court-line bg-black px-2.5 py-1 text-[11px] font-black uppercase text-zinc-400">
                    {event.questions.length + event.tests.length} Practice
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase tracking-wide text-cyan-300">Recommended</div>
          <h2 className="mt-2 text-3xl font-black italic uppercase text-white">Featured Resources</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {featuredResources.map((resource) => (
              <Link
                key={`${resource.eventSlug}-${resource.title}`}
                href={`/resources/${resource.eventSlug}`}
                className="rounded-md border border-court-line bg-court-elevated p-4 transition hover:border-fuchsia-400/70"
              >
                <div className="text-[11px] font-black uppercase text-cyan-300">{resource.eventName}</div>
                <div className="mt-2 text-lg font-black text-white">{resource.title}</div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{resource.description}</p>
                <div className="mt-3 text-[11px] font-black uppercase text-zinc-500">
                  {resource.type} / {resource.topic} / {resource.difficulty}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
