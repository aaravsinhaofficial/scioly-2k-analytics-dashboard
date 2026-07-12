"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { SciolyQuestion, SciolyTest } from "@/lib/resource-data";

type Question = SciolyQuestion & { eventName: string; eventSlug: string };
type Test = SciolyTest & { eventName: string; eventSlug: string };

export function PracticeLibrary({ questions, tests }: { questions: Question[]; tests: Test[] }) {
  const [view, setView] = useState<"questions" | "tests">("questions");
  const [query, setQuery] = useState("");
  const [eventName, setEventName] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const events = useMemo(() => ["All", ...Array.from(new Set([...questions, ...tests].map((item) => item.eventName))).sort()], [questions, tests]);
  const normalized = query.trim().toLowerCase();
  const items = view === "questions"
    ? questions.filter((item) => (eventName === "All" || item.eventName === eventName) && (difficulty === "All" || item.difficulty === difficulty) && (!normalized || `${item.question} ${item.topic} ${item.eventName}`.toLowerCase().includes(normalized)))
    : tests.filter((item) => (eventName === "All" || item.eventName === eventName) && (difficulty === "All" || item.difficulty === difficulty) && (!normalized || `${item.title} ${item.description} ${item.eventName}`.toLowerCase().includes(normalized)));

  return (
    <section className="overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm">
      <div className="space-y-4 border-b border-court-line p-4 sm:p-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Practice type">
          <button type="button" onClick={() => setView("questions")} className={`rounded-md px-4 text-sm font-medium ${view === "questions" ? "bg-white text-black" : "bg-court-elevated text-zinc-600"}`} role="tab" aria-selected={view === "questions"}>Questions ({questions.length})</button>
          <button type="button" onClick={() => setView("tests")} className={`rounded-md px-4 text-sm font-medium ${view === "tests" ? "bg-white text-black" : "bg-court-elevated text-zinc-600"}`} role="tab" aria-selected={view === "tests"}>Tests ({tests.length})</button>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_220px_160px]">
          <label className="relative"><span className="sr-only">Search practice</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search practice" className="w-full rounded-md border border-court-line bg-court-panel pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
          <select value={eventName} onChange={(event) => setEventName(event.target.value)} aria-label="Filter by event" className="rounded-md border border-court-line bg-court-panel px-3 text-sm text-white"><option value="All">All events</option>{events.slice(1).map((event) => <option key={event}>{event}</option>)}</select>
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Filter by difficulty" className="rounded-md border border-court-line bg-court-panel px-3 text-sm text-white"><option value="All">All levels</option><option>Rookie</option><option>Pro</option><option>All-Star</option></select>
        </div>
        <p className="text-sm text-zinc-500">{items.length} matching {view}</p>
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">
        {items.map((item) => {
          const isQuestion = "question" in item;
          return (
            <Link key={isQuestion ? `${item.eventSlug}-${item.question}` : `${item.eventSlug}-${item.title}`} href={`/resources/${item.eventSlug}`} className="rounded-md border border-court-line p-4 transition-colors hover:border-cyan-400 hover:bg-court-elevated">
              <div className="text-xs font-medium text-cyan-300">{item.eventName} · {item.difficulty}</div>
              <h3 className="mt-2 font-semibold leading-6 text-white">{isQuestion ? item.question : item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{isQuestion ? `Topic: ${item.topic}` : item.description}</p>
              <p className="mt-3 text-xs font-medium text-cyan-300">Open event resources →</p>
            </Link>
          );
        })}
        {items.length === 0 ? <div className="col-span-full py-10 text-center"><p className="font-medium text-white">No matching practice</p><p className="mt-1 text-sm text-zinc-500">Try another event, level, or search.</p></div> : null}
      </div>
    </section>
  );
}
