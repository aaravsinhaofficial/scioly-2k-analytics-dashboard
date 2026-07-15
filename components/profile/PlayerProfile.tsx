"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ExternalLink, Medal, Trophy, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ReadinessBadge } from "@/components/ReadinessBadge";
import { StatTile } from "@/components/StatTile";
import { PlayerTrendChart } from "@/components/charts/PlayerTrendChart";
import { PointHistoryTable } from "@/components/points/PointHistoryTable";
import { DeleteAccountPanel } from "@/components/profile/DeleteAccountPanel";
import type { PlayerDetail } from "@/lib/types";
import { searchAnchor } from "@/lib/search-utils";
import { cn, formatDate, formatNumber } from "@/lib/utils";

interface PlayerProfileProps {
  player: PlayerDetail;
  mode?: "modal" | "page";
  onClose?: () => void;
  canWithdrawPoints?: boolean;
  canRemovePoints?: boolean;
  canDeleteAccount?: boolean;
  accountEmail?: string;
}

export function PlayerProfile({
  player,
  mode = "page",
  onClose,
  canWithdrawPoints = false,
  canRemovePoints = false,
  canDeleteAccount = false,
  accountEmail
}: PlayerProfileProps) {
  const [tab, setTab] = useState<"competitions" | "points">("competitions");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode !== "modal") return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (closeButtonRef.current ?? dialogRef.current)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.getAttribute("aria-hidden") !== "true");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [mode, onClose]);

  const content = (
    <div className={cn("bg-court-black", mode === "modal" ? "min-h-screen" : "rounded-md border border-court-line")}>
      <div className="border-b border-court-line bg-court-panel/80">
        <div className="flex flex-col gap-6 p-5 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar name={player.name} src={player.profilePictureUrl} size="xl" />
            <div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                <span>Rank #{player.rank}</span>
                <span>{player.teamDesignation} Team</span>
                <span>Grade {player.grade}</span>
              </div>
              <h1 id={`player-${player.id}-heading`} className="mt-2 text-balance text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {player.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ReadinessBadge value={player.readinessScore} status={player.readinessStatus} showLabel />
                {player.readinessIsProvisional ? <span className="text-xs font-medium text-amber-200">Provisional</span> : null}
              </div>
              {player.profileEvents && player.profileEvents.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {player.profileEvents.map((event) => (
                    <Link key={event} href={`/resources/${searchAnchor(event)}`} className="rounded-full bg-court-elevated px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:text-cyan-300">
                      {event}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canRemovePoints ? (
              <Link
                href="/admin/manage?tab=points"
                className="inline-flex h-11 items-center rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 transition hover:border-cyan-400 hover:text-white"
              >
                Edit logs
              </Link>
            ) : null}
            {mode === "modal" ? (
              <Link
                href={`/profile/${player.id}`}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 transition hover:border-cyan-400 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Open full profile
              </Link>
            ) : null}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                ref={closeButtonRef}
                className="grid h-11 w-11 place-items-center rounded-md border border-court-line text-zinc-600 transition hover:border-red-400 hover:text-white"
                aria-label="Close player detail"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 md:p-8">
        <section aria-labelledby={`player-${player.id}-readiness-heading`}>
          <h2 id={`player-${player.id}-readiness-heading`} className="mb-3 text-lg font-semibold text-white">Current readiness</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Overall readiness"
              value={<ReadinessBadge value={player.readinessScore} status={player.readinessStatus} size="sm" showLabel />}
              detail={player.readinessIsProvisional ? "Provisional until competition and testoff data are both available" : "Competition, testoffs, and recent preparation"}
            />
            <StatTile
              label="Competition component"
              value={player.competitionScore || "—"}
              detail="60% of readiness when available"
            />
            <StatTile
              label="Testoff component"
              value={player.testoffScore || "—"}
              detail="30% of readiness when available"
            />
            <StatTile label="Preparation component" value={player.preparationScore} detail={`${formatNumber(player.thirtyDayPoints)} approved points in 30 days`} />
          </div>
        </section>

        <section aria-labelledby={`player-${player.id}-activity-heading`}>
          <h2 id={`player-${player.id}-activity-heading`} className="mb-3 text-lg font-semibold text-white">Activity totals</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Approved practice" value={formatNumber(player.approvedPracticePoints)} detail="All time" />
            <StatTile label="Pending practice" value={formatNumber(player.pendingPracticePoints)} detail="Awaiting officer review" />
            <StatTile label="Competition points" value={formatNumber(player.competitionPoints)} detail="Recorded tournament results" />
            <StatTile
              label="Tournaments attended"
              value={player.tournamentsAttended}
              detail={
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Weekly snapshots active
                </span>
              }
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">Progress over time</h2>
          </div>
          <PlayerTrendChart snapshots={player.snapshots} />
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Medal className="h-5 w-5 text-amber-200" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">Event performance</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {player.eventBreakdowns.length > 0 ? (
              player.eventBreakdowns.map((event) => (
                <Link key={event.eventId} href={`/resources/${searchAnchor(event.eventName)}`} className="group rounded-md border border-court-line bg-court-panel p-4 transition-colors hover:border-cyan-400 hover:bg-court-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  <div className="text-xs font-black uppercase text-zinc-500">{event.category}</div>
                  <div className="mt-1 min-h-10 text-lg font-black text-white group-hover:text-cyan-300">{event.eventName}</div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[11px] font-black uppercase text-zinc-500">Times</div>
                      <div className="font-black text-white">{event.timesCompeted}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-zinc-500">Avg Place</div>
                      <div className="font-black text-white">{event.avgPlacement.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-zinc-500">Medals</div>
                      <div className="font-black text-amber-200">{event.medals}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-zinc-500">Readiness</div>
                      <div className="font-black text-cyan-300">{event.eventReadiness}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase text-zinc-500">Best</div>
                      <div className="font-black text-white">#{event.bestFinish}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-medium text-cyan-300">Open event library →</div>
                </Link>
              ))
            ) : (
              <div className="rounded-md border border-court-line bg-court-panel p-4 text-sm text-zinc-500">
                No event placements yet.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">History</h2>
            <div className="inline-flex rounded-md border border-court-line bg-court-panel p-1" role="group" aria-label="Choose profile history">
              {(["competitions", "points"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  aria-pressed={tab === item}
                  className={cn(
                    "h-9 rounded px-3 text-xs font-black uppercase text-zinc-600 transition hover:text-white",
                    tab === item && "bg-white text-black hover:text-black"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {tab === "competitions" ? (
            <div role="region" tabIndex={0} aria-label={`${player.name} competition history table`} className="overflow-x-auto rounded-md border border-court-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
              <table className="w-full min-w-[1060px] border-collapse bg-court-panel text-left text-sm">
                <caption className="sr-only">Competition history for {player.name}</caption>
                <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Tournament</th>
                    <th scope="col" className="px-4 py-3">Event</th>
                    <th scope="col" className="px-4 py-3">Participants</th>
                    <th scope="col" className="px-4 py-3">Rank</th>
                    <th scope="col" className="px-4 py-3">Medal</th>
                    <th scope="col" className="px-4 py-3">SOS</th>
                    <th scope="col" className="px-4 py-3">Benchmark</th>
                    <th scope="col" className="px-4 py-3">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {player.competitionHistory.map((row) => (
                    <tr key={row.id} className="border-t border-court-line">
                      <td className="px-4 py-3 text-zinc-500">{formatDate(row.date)}</td>
                      <th scope="row" className="px-4 py-3 text-left font-bold text-white">{row.tournament}</th>
                      <td className="px-4 py-3 text-white"><Link href={`/resources/${searchAnchor(row.event)}`} className="hover:text-cyan-300">{row.event}</Link></td>
                      <td className="px-4 py-3 text-zinc-500">{row.participantNames.join(", ")}</td>
                      <td className="px-4 py-3 font-black text-white">#{row.rank}</td>
                      <td className="px-4 py-3 font-black">{row.isMedal ? <span className="text-amber-200">Yes</span> : <span className="text-zinc-500">No</span>}</td>
                      <td className={cn("px-4 py-3 font-black", row.sos >= 1.5 ? "text-emerald-300" : "text-red-300")}>
                        {row.sos.toFixed(2)}x
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{row.benchmarkSchool}</div>
                        <div className="text-[11px] font-black uppercase text-zinc-500">
                          {row.benchmarkSource} · {row.relativeDifficultyMultiplier.toFixed(2)}x
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-cyan-300">{row.eventPoints}</div>
                        <div className="text-[11px] text-zinc-500">score {row.placementScore.toFixed(1)}</div>
                      </td>
                    </tr>
                  ))}
                  {player.competitionHistory.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-10 text-center text-zinc-500">No competition results have been recorded yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-court-line bg-court-panel">
              <PointHistoryTable
                rows={player.pointHistory}
                canWithdrawPending={canWithdrawPoints}
                canRemoveAny={canRemovePoints}
                emptyTitle="No point history yet"
                emptyDescription="Practice submissions will appear here."
              />
            </div>
          )}
        </section>

        {mode === "page" && canDeleteAccount && accountEmail ? <DeleteAccountPanel email={accountEmail} /> : null}
      </div>
    </div>
  );

  if (mode === "modal") {
    return (
      <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 overflow-y-auto focus:outline-none" role="dialog" aria-modal="true" aria-labelledby={`player-${player.id}-heading`}>
        <div onClick={onClose} className="app-overlay fixed inset-0 h-full w-full backdrop-blur-sm" aria-hidden="true" />
        <div className="relative ml-auto min-h-full w-full max-w-6xl shadow-panel">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
