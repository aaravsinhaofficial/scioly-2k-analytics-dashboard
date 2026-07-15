"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SciolyEventHub } from "@/lib/resource-data";

export function ResourceDirectory({ events }: { events: SciolyEventHub[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => ["All", ...Array.from(new Set(events.map((event) => event.category)))], [events]);
  const seasonEvents = events.filter((event) => event.season === 2027);
  const trialCount = seasonEvents.filter((event) => event.isTrial).length;
  const teamLibraryCount = events.length - seasonEvents.length;
  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return events.filter((event) => {
      const matchesCategory = category === "All" || event.category === category;
      const matchesQuery = !normalized || [
        event.name,
        event.tagline,
        event.category,
        ...event.topics,
        ...event.resources.map((resource) => resource.title),
      ].some((value) => value.toLowerCase().includes(normalized));
      return matchesCategory && matchesQuery;
    });
  }, [category, events, query]);
  const hasActiveFilters = Boolean(query.trim()) || category !== "All";

  function clearFilters() {
    setQuery("");
    setCategory("All");
  }

  return (
    <section id="resource-directory" className="scroll-mt-24 min-w-0 rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-6" aria-labelledby="resource-directory-heading" data-tour="resources-directory">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="resource-directory-heading" className="text-xl font-semibold text-white">Resources by event</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {filteredEvents.length} of {events.length} libraries · {seasonEvents.length - trialCount} scored events{trialCount ? ` + ${trialCount} featured trial` : ""}{teamLibraryCount ? ` + ${teamLibraryCount} team archive` : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-zinc-500 sm:w-72">
            Search
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Events, topics, or resources"
                className="h-11 w-full rounded-md border border-court-line bg-court-panel pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-400"
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-zinc-500">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none focus:border-cyan-400 sm:w-36"
            >
              {categories.map((item) => <option key={item} value={item}>{item === "All" ? "All categories" : item}</option>)}
            </select>
          </label>
          {hasActiveFilters ? <button type="button" onClick={clearFilters} className="min-h-11 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">Clear</button> : null}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{filteredEvents.length} event {filteredEvents.length === 1 ? "library" : "libraries"} shown.</p>

      {filteredEvents.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredEvents.map((event) => (
            <Link
              key={event.slug}
              href={`/resources/${event.slug}`}
              className="group rounded-md border border-court-line p-4 transition-colors hover:border-cyan-400 hover:bg-court-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-500">{event.category}</div>
                  <h3 className="mt-1 break-words text-lg font-semibold text-white group-hover:text-cyan-300">{event.name}</h3>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {event.isTrial ? <span className="rounded-full bg-amber-300/10 px-2.5 py-1 text-xs font-medium text-amber-200">Featured trial</span> : null}
                  <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">
                    {event.season && event.rulesStatus ? `${event.season} ${event.rulesStatus.toLowerCase()}` : "Team library"}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-500">{event.tagline}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span>{event.resources.length} shared resources</span>
                <span aria-hidden="true">·</span>
                <span>{event.questions.length + event.tests.length} practice items</span>
                {event.rulesStatus ? <><span aria-hidden="true">·</span><span>{event.season} {event.rulesStatus.toLowerCase()} scope</span></> : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md bg-court-elevated px-4 py-10 text-center">
          <p className="font-medium text-white">No matching events</p>
          <p className="mt-1 text-sm text-zinc-500">Try a broader search or another category.</p>
          <button type="button" onClick={clearFilters} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-court-line px-4 text-sm font-semibold text-zinc-600 hover:border-cyan-400 hover:text-white">Clear filters</button>
        </div>
      )}
    </section>
  );
}
