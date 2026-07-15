"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SciolyQuestion, SciolyTest } from "@/lib/resource-data";
import { libraryContentAnchor } from "@/lib/search-utils";

type Question = SciolyQuestion & { eventName: string; eventSlug: string };
type Test = SciolyTest & { eventName: string; eventSlug: string };

export function PracticeLibrary({
  questions,
  tests,
  eventNames,
  canManage = false,
}: {
  questions: Question[];
  tests: Test[];
  eventNames: string[];
  canManage?: boolean;
}) {
  const [view, setView] = useState<"questions" | "tests">("questions");
  const [query, setQuery] = useState("");
  const [eventName, setEventName] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const events = useMemo(() => ["All", ...Array.from(new Set([...eventNames, ...questions.map((item) => item.eventName), ...tests.map((item) => item.eventName)])).sort()], [eventNames, questions, tests]);
  const normalized = query.trim().toLowerCase();
  const items = view === "questions"
    ? questions.filter((item) => (eventName === "All" || item.eventName === eventName) && (difficulty === "All" || item.difficulty === difficulty) && (!normalized || `${item.question} ${item.topic} ${item.eventName}`.toLowerCase().includes(normalized)))
    : tests.filter((item) => (eventName === "All" || item.eventName === eventName) && (difficulty === "All" || item.difficulty === difficulty) && (!normalized || `${item.title} ${item.description} ${item.eventName}`.toLowerCase().includes(normalized)));
  const hasActiveFilters = Boolean(query) || eventName !== "All" || difficulty !== "All";

  function clearFilters() {
    setQuery("");
    setEventName("All");
    setDifficulty("All");
  }

  return (
    <section id="practice-library" className="scroll-mt-24 min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm" data-tour="practice-library">
      <div className="space-y-4 border-b border-court-line p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose practice content">
          <button type="button" onClick={() => setView("questions")} className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${view === "questions" ? "bg-white text-black" : "bg-court-elevated text-zinc-600 hover:text-white"}`} aria-pressed={view === "questions"}>Questions ({questions.length})</button>
          <button type="button" onClick={() => setView("tests")} className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${view === "tests" ? "bg-white text-black" : "bg-court-elevated text-zinc-600 hover:text-white"}`} aria-pressed={view === "tests"}>Tests ({tests.length})</button>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_160px_auto] md:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-zinc-500">
            Search
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${view}`} className="h-11 w-full rounded-md border border-court-line bg-court-panel pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-400" />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-zinc-500">
            Event
            <select value={eventName} onChange={(event) => setEventName(event.target.value)} className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none focus:border-cyan-400"><option value="All">All events</option>{events.slice(1).map((event) => <option key={event}>{event}</option>)}</select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-zinc-500">
            Difficulty
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none focus:border-cyan-400"><option value="All">All levels</option><option>Rookie</option><option>Pro</option><option>All-Star</option></select>
          </label>
          {hasActiveFilters ? <button type="button" onClick={clearFilters} className="min-h-11 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">Clear filters</button> : null}
        </div>
        <p className="text-sm text-zinc-500" role="status" aria-live="polite">Showing {items.length} {view}{hasActiveFilters ? " matching your filters" : ""}</p>
      </div>

      <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const isQuestion = "question" in item;
          const href = !isQuestion && item.libraryId
            ? `/practice/tests/${item.libraryId}`
            : `/resources/${item.eventSlug}#${isQuestion ? `question-${libraryContentAnchor(item.question, item.libraryId)}` : `test-${libraryContentAnchor(item.title, item.libraryId)}`}`;
          return (
            <Link key={item.libraryId ?? (isQuestion ? `${item.eventSlug}-${item.question}` : `${item.eventSlug}-${item.title}`)} href={href} className="min-w-0 rounded-md border border-court-line p-4 transition-colors hover:border-cyan-400 hover:bg-court-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              <div className="text-xs font-medium text-cyan-300">{item.eventName} · {item.difficulty}</div>
              <h3 className="mt-2 break-words font-semibold leading-6 text-white">{isQuestion ? item.question : item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{isQuestion ? `Topic: ${item.topic}` : item.description}</p>
              <p className="mt-3 text-sm font-medium text-cyan-300">{isQuestion ? "Answer this question" : item.libraryId ? "Start interactive test" : "Open test details"} →</p>
            </Link>
          );
        })}
        {items.length === 0 ? (
          <div className="col-span-full rounded-md border border-dashed border-court-line px-4 py-10 text-center">
            <p className="font-medium text-white">No {view === "questions" ? "questions" : "tests"} published for this filter</p>
            <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-zinc-500">
              {hasActiveFilters ? "Clear a filter or choose another event." : "Your team has not added real practice material here yet."}
            </p>
            {hasActiveFilters ? <button type="button" onClick={clearFilters} className="mt-4 inline-flex min-h-11 items-center rounded-md border border-court-line px-4 text-sm font-semibold text-zinc-600 hover:border-cyan-400 hover:text-white">Clear all filters</button> : null}
            {canManage ? <Link href="/admin/library" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Add practice material</Link> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
