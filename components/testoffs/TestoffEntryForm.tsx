"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, Save, Search, Users } from "lucide-react";
import type { EventCategory, TestoffAdminData } from "@/lib/types";

interface TestoffEntryFormProps {
  data: TestoffAdminData;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function seasonNameForDate(value: string) {
  const parsed = new Date(`${value}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  const startYear = parsed.getUTCMonth() >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function previewRanks(scores: Record<string, string>) {
  const ordered = Object.entries(scores)
    .filter(([, value]) => value.trim() !== "" && Number.isFinite(Number(value)))
    .map(([studentId, value]) => ({ studentId, score: Number(value) }))
    .sort((left, right) => right.score - left.score || left.studentId.localeCompare(right.studentId));
  const ranks = new Map<string, number>();
  let rank = 0;
  let prior: number | undefined;
  ordered.forEach((entry, index) => {
    if (prior === undefined || Math.abs(entry.score - prior) > 0.0005) {
      rank = index + 1;
      prior = entry.score;
    }
    ranks.set(entry.studentId, rank);
  });
  return ranks;
}

export function TestoffEntryForm({ data }: TestoffEntryFormProps) {
  const router = useRouter();
  const initialDate = today();
  const initialSeason = data.activeSeasonId ?? data.seasons[0]?.id;
  const currentEvents = data.events.filter((event) => event.isCurrentSeason);
  const legacyEvents = data.events.filter((event) => !event.isCurrentSeason);
  const [seasonChoice, setSeasonChoice] = useState(initialSeason ? String(initialSeason) : "new");
  const [newSeasonName, setNewSeasonName] = useState(seasonNameForDate(initialDate));
  const [eventChoice, setEventChoice] = useState(data.events[0]?.value ?? "new");
  const [newEventName, setNewEventName] = useState("");
  const [newEventCategory, setNewEventCategory] = useState<EventCategory>("study");
  const [name, setName] = useState("Testoff 1");
  const [date, setDate] = useState(initialDate);
  const [maxScore, setMaxScore] = useState("100");
  const [weight, setWeight] = useState("1");
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ranks = useMemo(() => previewRanks(scores), [scores]);
  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data.students;
    return data.students.filter(
      (student) => student.name.toLowerCase().includes(query) || String(student.grade).includes(query)
    );
  }, [data.students, search]);
  const enteredCount = Object.values(scores).filter((value) => value.trim() !== "").length;

  function updateDate(nextDate: string) {
    const oldDefault = seasonNameForDate(date);
    setDate(nextDate);
    if (seasonChoice === "new" && newSeasonName === oldDefault && nextDate) {
      setNewSeasonName(seasonNameForDate(nextDate));
    }
  }

  function submit() {
    setMessage(null);
    setError(null);
    const selectedEvent = data.events.find((event) => event.value === eventChoice);
    const results = data.students.flatMap((student) => {
      const value = scores[student.id]?.trim();
      if (value === undefined || value === "") return [];
      return [{ studentId: student.id, rawScore: Number(value) }];
    });

    if (results.length === 0) {
      setError("Enter at least one student score.");
      return;
    }
    if (eventChoice !== "new" && !selectedEvent) {
      setError("Choose an event from the updated event list.");
      return;
    }

    startTransition(async () => {
      try {
        const eventInput = eventChoice === "new"
          ? { eventName: newEventName, eventCategory: newEventCategory }
          : selectedEvent?.id
            ? { eventId: selectedEvent.id }
            : { eventName: selectedEvent?.name, eventCategory: selectedEvent?.category };
        const response = await fetch("/api/admin/testoffs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seasonId: seasonChoice === "new" ? undefined : Number(seasonChoice),
            seasonName: seasonChoice === "new" ? newSeasonName : undefined,
            ...eventInput,
            name,
            date,
            maxScore: Number(maxScore),
            weight: Number(weight),
            notes,
            results
          })
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string; error?: string }
          | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Could not save the testoff.");
        setMessage(payload.message ?? "Testoff saved.");
        setScores({});
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save the testoff.");
      }
    });
  }

  if (!data.configured) {
    return (
      <section className="rounded-md border border-court-line bg-court-panel p-8 text-center">
        <ClipboardCheck className="mx-auto h-10 w-10 text-zinc-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-white">Score entry is offline</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
          This demo has no connected database. Configure Supabase on Vercel before entering real team scores.
        </p>
      </section>
    );
  }

  if (data.students.length === 0) {
    return (
      <section className="rounded-md border border-court-line bg-court-panel p-8 text-center">
        <Users className="mx-auto h-10 w-10 text-zinc-600" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold text-white">Roster setup required</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
          Add at least one student before creating a testoff session.
        </p>
      </section>
    );
  }

  return (
    <div aria-busy={isPending || undefined} className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <section className="h-fit rounded-md border border-court-line bg-court-panel" aria-labelledby="testoff-details-heading">
        <div className="border-b border-court-line p-5">
          <div className="text-xs font-black uppercase text-cyan-300">Session Setup</div>
          <h2 id="testoff-details-heading" className="mt-1 text-xl font-semibold text-white">Testoff details</h2>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Season
            <select
              value={seasonChoice}
              onChange={(event) => setSeasonChoice(event.target.value)}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
            >
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}{season.isActive ? " (Active)" : ""}
                </option>
              ))}
              <option value="new">Create a new season…</option>
            </select>
          </label>

          {seasonChoice === "new" ? (
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              New Season Name
              <input
                required
                value={newSeasonName}
                onChange={(event) => setNewSeasonName(event.target.value)}
                maxLength={80}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
              />
            </label>
          ) : null}

          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Event
            <select
              value={eventChoice}
              onChange={(event) => setEventChoice(event.target.value)}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
            >
              <optgroup label="2027 Division C events">
                {currentEvents.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.name}{event.isTrial ? " — Trial" : ""} ({event.category === "build" ? "Build" : "Study"})
                  </option>
                ))}
              </optgroup>
              {legacyEvents.length > 0 ? (
                <optgroup label="Legacy and custom events">
                  {legacyEvents.map((event) => (
                    <option key={event.value} value={event.value}>
                      {event.name} ({event.category === "build" ? "Build" : "Study"})
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="Other">
                <option value="new">Create a new event…</option>
              </optgroup>
            </select>
          </label>

          {eventChoice === "new" ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
              <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
                New Event Name
                <input
                  required
                  value={newEventName}
                  onChange={(event) => setNewEventName(event.target.value)}
                  maxLength={120}
                  className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
                />
              </label>
              <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
                Category
                <select
                  value={newEventCategory}
                  onChange={(event) => setNewEventCategory(event.target.value as EventCategory)}
                  className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
                >
                  <option value="study">Study</option>
                  <option value="build">Build</option>
                </select>
              </label>
            </div>
          ) : null}

          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Session Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Date
            <input
              type="date"
              required
              value={date}
              onChange={(event) => updateDate(event.target.value)}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              Max Score
              <input
                type="number"
                min="0.001"
                step="any"
                required
                value={maxScore}
                onChange={(event) => setMaxScore(event.target.value)}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              Weight
              <input
                type="number"
                min="0.001"
                max="10"
                step="0.25"
                required
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Notes (Optional)
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="resize-y rounded-md border border-court-line bg-court-elevated p-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
            />
          </label>

          <div className="rounded-md border border-court-line bg-court-elevated p-3 text-xs leading-5 text-zinc-500">
            The server assigns descending ranks. Supabase normalizes each raw score to the maximum and applies this
            session’s weight.
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={
              isPending ||
              !name.trim() ||
              !date ||
              (eventChoice === "new" && !newEventName.trim()) ||
              (seasonChoice === "new" && !newSeasonName.trim()) ||
              enteredCount === 0
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {isPending ? "Saving testoff…" : "Save testoff"}
          </button>

          {message ? <div role="status" className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">{message}</div> : null}
          {error ? <div role="alert" className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-court-line bg-court-panel" aria-labelledby="raw-scores-heading">
        <div className="flex flex-col gap-3 border-b border-court-line p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-black uppercase text-cyan-300">Roster Scores</div>
            <h2 id="raw-scores-heading" className="mt-1 text-xl font-semibold text-white">Enter raw scores</h2>
            <p className="mt-1 text-sm text-zinc-500">Blank students are omitted. Zero is a valid entered score.</p>
          </div>
          <div className="text-xs font-black uppercase text-zinc-500" role="status" aria-live="polite">{enteredCount} entered</div>
        </div>

        <div className="border-b border-court-line p-4">
          <label className="relative block">
            <span className="sr-only">Search students by name or grade</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search students or grade…"
              className="h-11 w-full rounded-md border border-court-line bg-court-elevated pl-10 pr-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-cyan-400"
            />
          </label>
        </div>

        <div className="max-h-[760px] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400" role="region" aria-labelledby="raw-scores-heading" tabIndex={0}>
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <caption className="sr-only">Student raw score entry and calculated rank preview</caption>
            <thead className="sticky top-0 z-10 bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">Student</th>
                <th scope="col" className="px-4 py-3">Grade</th>
                <th scope="col" className="px-4 py-3 text-right">Raw score</th>
                <th scope="col" className="px-4 py-3 text-right">Rank preview</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-t border-court-line">
                  <th scope="row" className="px-4 py-3 text-left font-black text-white">{student.name}</th>
                  <td className="px-4 py-3 font-bold text-zinc-500">{student.grade}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      max={Number(maxScore) || undefined}
                      step="any"
                      value={scores[student.id] ?? ""}
                      aria-label={`Raw score for ${student.name}`}
                      onChange={(event) =>
                        setScores((current) => ({ ...current, [student.id]: event.target.value }))
                      }
                      placeholder="—"
                      className="h-10 w-32 rounded-md border border-court-line bg-court-elevated px-3 text-right font-black text-white outline-none placeholder:text-zinc-700 focus:border-cyan-400"
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-black italic text-cyan-300">
                    {ranks.has(student.id) ? `#${ranks.get(student.id)}` : "—"}
                  </td>
                </tr>
              ))}
              {visibleStudents.length === 0 ? <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">No students match this search.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
