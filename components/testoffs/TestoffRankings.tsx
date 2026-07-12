"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardList, Loader2, Scale, Trash2, Trophy } from "lucide-react";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import type { TestoffDashboardData, TestoffEventRanking } from "@/lib/types";

interface TestoffRankingsProps {
  data: TestoffDashboardData;
  canManage?: boolean;
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function EmptyState({ configured }: { configured: boolean }) {
  return (
    <section className="rounded-md border border-court-line bg-court-panel p-8 text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-zinc-600" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-semibold text-white">No testoffs yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
        {configured
          ? "An officer can enter the first testoff session from the score-entry page. Rankings will appear here automatically."
          : "This demo has no connected database. Testoff sessions will appear here after the Vercel deployment is connected to Supabase."}
      </p>
    </section>
  );
}

function RankingTable({ event }: { event: TestoffEventRanking }) {
  return (
    <section className="overflow-hidden rounded-md border border-court-line bg-court-panel">
      <div className="flex flex-col gap-3 border-b border-court-line p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase text-cyan-300">{event.eventCategory} event</div>
          <h2 className="mt-1 text-2xl font-semibold text-white">{event.eventName} rankings</h2>
        </div>
        <div className="rounded-md border border-court-line bg-court-elevated px-3 py-2 text-xs font-black uppercase text-zinc-400">
          {event.sessions.length} session{event.sessions.length === 1 ? "" : "s"} · {formatScore(event.totalWeight)}x total weight
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3 text-right">Composite</th>
              <th className="px-4 py-3 text-right">Completed</th>
              <th className="px-4 py-3 text-right">Weighted Total</th>
            </tr>
          </thead>
          <tbody>
            {event.rankings.length > 0 ? (
              event.rankings.map((entry) => (
                <tr key={entry.studentId} className="border-t border-court-line">
                  <td className="px-4 py-4 text-lg font-black italic text-zinc-500">#{entry.rank}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={entry.studentName} size="sm" />
                      <span className="font-black text-white">{entry.studentName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-xl font-black italic text-cyan-300">
                    {entry.compositeScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-zinc-300">
                    {entry.completedSessions}/{entry.totalSessions}
                  </td>
                  <td className="px-4 py-4 text-right font-black text-white">
                    {formatScore(entry.weightedScore)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  This event has sessions but no saved results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-court-line bg-court-elevated px-5 py-3 text-xs leading-5 text-zinc-500">
        Composite = sum of each normalized score × session weight ÷ total event weight. A missed session contributes
        zero until a score is entered.
      </div>
    </section>
  );
}

function SessionCards({
  event,
  canManage,
  deletingId,
  onDelete
}: {
  event: TestoffEventRanking;
  canManage: boolean;
  deletingId: number | null;
  onDelete: (sessionId: number, sessionName: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-pink-300" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">Session details</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {event.sessions.map((session) => (
          <article key={session.id} className="overflow-hidden rounded-md border border-court-line bg-court-panel">
            <div className="border-b border-court-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase text-cyan-300">{formatDateOnly(session.date)}</div>
                  <h3 className="mt-1 text-lg font-semibold text-white">{session.name}</h3>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-md border border-court-line bg-court-elevated px-2.5 py-1 text-[11px] font-black uppercase text-zinc-300">
                    Max {formatScore(session.maxScore)}
                  </span>
                  <span className="rounded-md border border-pink-400/40 bg-pink-400/10 px-2.5 py-1 text-[11px] font-black uppercase text-pink-200">
                    {formatScore(session.weight)}x
                  </span>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => onDelete(session.id, session.name)}
                      disabled={deletingId === session.id}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-red-400/40 bg-red-400/10 px-2.5 text-[11px] font-black uppercase text-red-200 transition hover:bg-red-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                      title="Delete this session and re-enter corrected scores. Admins can undo the deletion."
                    >
                      {deletingId === session.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Delete and re-enter
                    </button>
                  ) : null}
                </div>
              </div>
              {session.notes ? <p className="mt-3 text-sm leading-6 text-zinc-400">{session.notes}</p> : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead className="bg-court-elevated text-[10px] font-black uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5">Place</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5 text-right">Raw</th>
                    <th className="px-4 py-2.5 text-right">Percent</th>
                    <th className="px-4 py-2.5 text-right">Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {session.results.map((result) => (
                    <tr key={result.id} className="border-t border-court-line">
                      <td className="px-4 py-3 font-black text-zinc-500">#{result.rank}</td>
                      <td className="px-4 py-3 font-bold text-white">{result.studentName}</td>
                      <td className="px-4 py-3 text-right font-black text-zinc-200">
                        {formatScore(result.rawScore)}/{formatScore(session.maxScore)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-zinc-400">
                        {((result.rawScore / session.maxScore) * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-black text-cyan-300">
                        {formatScore(result.rankingScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function TestoffRankings({ data, canManage = false }: TestoffRankingsProps) {
  const router = useRouter();
  const initialSeasonId = data.activeSeasonId ?? data.eventRankings[0]?.seasonId ?? data.seasons[0]?.id;
  const [seasonId, setSeasonId] = useStateNumber(initialSeasonId);
  const [eventId, setEventId] = useStateNumber(data.eventRankings.find((group) => group.seasonId === initialSeasonId)?.eventId);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(null);
  const [, startCorrection] = useTransition();

  function deleteSession(sessionId: number, sessionName: string) {
    if (!window.confirm(`Delete ${sessionName}? Its scores will be removed so you can re-enter them. An admin can restore the session from the audit log.`)) {
      return;
    }

    setDeletingId(sessionId);
    setCorrectionMessage(null);
    startCorrection(async () => {
      try {
        const response = await fetch("/api/admin/testoffs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; message?: string; error?: string }
          | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Could not delete the session.");
        setCorrectionMessage(payload.message ?? "Testoff session deleted.");
        router.refresh();
      } catch (caught) {
        setCorrectionMessage(caught instanceof Error ? caught.message : "Could not delete the session.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  if (data.eventRankings.length === 0) return <EmptyState configured={data.configured} />;

  const seasonEvents = data.eventRankings.filter((group) => group.seasonId === seasonId);
  const selectedEvent = seasonEvents.find((group) => group.eventId === eventId) ?? seasonEvents[0];

  return (
    <div className="space-y-5">
      {correctionMessage ? (
        <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">
          {correctionMessage}
        </div>
      ) : null}
      <section className="flex flex-col gap-4 rounded-md border border-court-line bg-court-panel p-4 md:flex-row md:items-end">
        <label className="grid flex-1 gap-2 text-xs font-black uppercase text-zinc-500">
          Season
          <select
            value={seasonId ?? ""}
            onChange={(event) => setSeasonId(Number(event.target.value))}
            className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
          >
            {data.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}{season.isActive ? " (Active)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid flex-1 gap-2 text-xs font-black uppercase text-zinc-500">
          Event
          <select
            value={selectedEvent?.eventId ?? ""}
            onChange={(event) => setEventId(Number(event.target.value))}
            className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
          >
            {seasonEvents.map((group) => (
              <option key={group.eventId} value={group.eventId}>
                {group.eventName}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3 rounded-md border border-court-line bg-court-elevated px-4 py-3 text-sm text-zinc-400 md:max-w-md">
          <Scale className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
          Scores are normalized before weights are applied.
        </div>
      </section>

      {selectedEvent ? (
        <>
          <RankingTable event={selectedEvent} />
          <SessionCards
            event={selectedEvent}
            canManage={canManage}
            deletingId={deletingId}
            onDelete={deleteSession}
          />
        </>
      ) : (
        <section className="rounded-md border border-court-line bg-court-panel p-8 text-center">
          <Trophy className="mx-auto h-9 w-9 text-zinc-600" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-semibold text-white">No sessions this season</h2>
          <p className="mt-2 text-sm text-zinc-400">Choose another season or ask an officer to enter a testoff.</p>
        </section>
      )}
    </div>
  );
}

function useStateNumber(initialValue?: number) {
  const [value, setValue] = useState<number | undefined>(initialValue);
  return [value, setValue] as const;
}
