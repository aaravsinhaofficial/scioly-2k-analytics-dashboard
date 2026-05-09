"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { ClipboardList, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import type { Student, TournamentImportPreview, TournamentSourceType } from "@/lib/types";
import { buildStaticTournamentPreview } from "@/lib/static-tournament-import";
import { cn, formatNumber } from "@/lib/utils";

interface TournamentUploadProps {
  currentUser: Student;
}

const sampleCsv = `Event,Rank,School,Team,Students,Medal
Water Quality,2,Obra D Tompkins High School,A,"Jack Lee; Mrinal Rao",Yes
Anatomy & Physiology,4,Obra D Tompkins High School,A,"Samanyu Pochanapeddi; Maya Iyer",Yes
Tower,7,Obra D Tompkins High School,A,"Aarav Shah; Nisha Patel",No
Disease Detectives,1,Seven Lakes High School,A,"Other Student",Yes`;

const manualSample = `Cy Falls Regional
2026-03-08
Schools: Obra D Tompkins High School; Cy Falls High School; Dulles High School
Water Quality: Jack Lee; Mrinal Rao A #2
Tower: Aarav Shah; Nisha Patel A #7`;

export function TournamentUpload({ currentUser }: TournamentUploadProps) {
  const [mode, setMode] = useState<TournamentSourceType>("duosmium_csv");
  const [rawInput, setRawInput] = useState(sampleCsv);
  const [tournamentName, setTournamentName] = useState("Cy Falls Regional");
  const [date, setDate] = useState("2026-03-08");
  const [medalCutoff, setMedalCutoff] = useState(6);
  const [participationPoints, setParticipationPoints] = useState(10);
  const [preview, setPreview] = useState<TournamentImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canUseManualDump = currentUser.role === "admin";

  function parse(commit = false) {
    setMessage(null);
    startTransition(async () => {
      const payload = {
        rawInput,
        commit,
        mode,
        tournamentName,
        date,
        medalCutoff,
        participationPoints
      };

      try {
        const response = await fetch("/api/tournaments/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const failure = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(failure?.error ?? "Tournament import API unavailable");
        }

        const result = (await response.json()) as {
          ok: boolean;
          preview?: TournamentImportPreview;
          message?: string;
          error?: string;
        };
        if (result.preview) {
          setPreview(result.preview);
        }
        setMessage(result.message ?? result.error ?? null);
      } catch (caught) {
        const staticPreview = buildStaticTournamentPreview(rawInput, {
          mode: mode === "manual" ? "manual" : "duosmium_csv",
          tournamentName,
          date,
          medalCutoff,
          participationPoints
        });
        setPreview(staticPreview);
        const error = caught instanceof Error ? errorMessage(caught.message) : "Parsed locally.";
        setMessage(commit ? `${error} Static demo cannot persist imports.` : error);
      }
    });
  }

  function errorMessage(message: string) {
    if (message.includes("Manual")) return message;
    return "Static demo: parsed locally with the deterministic CSV parser.";
  }

  function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      setRawInput(text);
      setPreview(null);
      setMessage(`${file.name} loaded.`);
    });
  }

  function switchMode(nextMode: TournamentSourceType) {
    if (nextMode === "manual" && !canUseManualDump) {
      setMessage("Manual tournament dumps are admin-only.");
      return;
    }
    setMode(nextMode);
    setRawInput(nextMode === "manual" ? manualSample : sampleCsv);
    setPreview(null);
    setMessage(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_440px]">
      <section className="rounded-md border border-court-line bg-court-panel">
        <div className="border-b border-court-line p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            Duosmium Parser
          </div>
          <h2 className="mt-1 text-2xl font-black italic uppercase text-white">Tournament Import</h2>
        </div>
        <div className="space-y-4 p-5">
          <div className="inline-flex rounded-md border border-court-line bg-court-elevated p-1">
            <button
              type="button"
              onClick={() => switchMode("duosmium_csv")}
              className={cn(
                "h-9 rounded px-3 text-xs font-black uppercase text-zinc-400 transition hover:text-white",
                mode === "duosmium_csv" && "bg-white text-black hover:text-black"
              )}
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => switchMode("manual")}
              className={cn(
                "h-9 rounded px-3 text-xs font-black uppercase text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40",
                mode === "manual" && "bg-white text-black hover:text-black"
              )}
              disabled={!canUseManualDump}
            >
              Manual
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              Tournament
              <input
                value={tournamentName}
                onChange={(event) => setTournamentName(event.target.value)}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              Medal Cutoff
              <input
                type="number"
                min={0}
                value={medalCutoff}
                onChange={(event) => setMedalCutoff(Number(event.target.value))}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
              />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
              Participation Points
              <input
                type="number"
                min={0}
                value={participationPoints}
                onChange={(event) => setParticipationPoints(Number(event.target.value))}
                className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
              />
            </label>
          </div>

          {mode === "duosmium_csv" ? (
            <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-black uppercase text-zinc-300 transition hover:border-white hover:text-white">
              <FileSpreadsheet className="h-4 w-4" />
              Load CSV
              <input type="file" accept=".csv,text/csv" onChange={loadFile} className="sr-only" />
            </label>
          ) : null}

          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            rows={16}
            className="w-full resize-y rounded-md border border-court-line bg-court-elevated p-4 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-400"
            placeholder={
              mode === "manual"
                ? "Admin-only manual dump, e.g. Water Quality: Jack Lee; Mrinal Rao A #2"
                : "Paste or load a Duosmium leaderboard CSV with Event, Rank, School, Team, Students, and Medal columns"
            }
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => parse(false)}
              disabled={isPending || rawInput.trim().length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
              Parse Preview
            </button>
            <button
              type="button"
              onClick={() => parse(true)}
              disabled={isPending || !preview}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-400/50 px-4 text-sm font-black uppercase text-cyan-200 transition hover:bg-cyan-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Commit Import
            </button>
            <button
              type="button"
              onClick={() => {
                setRawInput(mode === "manual" ? manualSample : sampleCsv);
                setPreview(null);
              }}
              className="inline-flex h-11 items-center justify-center rounded-md border border-court-line px-4 text-sm font-black uppercase text-zinc-300 transition hover:border-white hover:text-white"
            >
              Sample
            </button>
          </div>
          {message ? <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}
        </div>
      </section>

      <section className="rounded-md border border-court-line bg-court-panel p-5">
        <h2 className="text-xl font-black italic uppercase text-white">Preview</h2>
        {preview ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-court-line bg-court-elevated p-4">
              <div className="text-xs font-black uppercase text-zinc-500">Tournament</div>
              <div className="mt-1 text-xl font-black text-white">{preview.tournamentName}</div>
              <div className="mt-2 text-sm text-zinc-400">
                {preview.date} · {preview.sourceType === "manual" ? "Manual dump" : "Duosmium CSV"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-court-line bg-court-elevated p-4">
                <div className="text-xs font-black uppercase text-zinc-500">SOS</div>
                <div className="mt-1 text-3xl font-black italic text-cyan-300">{preview.sosMultiplier.toFixed(2)}x</div>
              </div>
              <div className="rounded-md border border-court-line bg-court-elevated p-4">
                <div className="text-xs font-black uppercase text-zinc-500">Medal Cutoff</div>
                <div className="mt-1 text-3xl font-black italic text-white">Top {preview.medalCutoff}</div>
              </div>
            </div>
            <div className="rounded-md border border-court-line bg-court-elevated p-4">
              <div className="text-xs font-black uppercase text-zinc-500">Benchmark Comparison</div>
              <div className="mt-1 font-black text-white">{preview.benchmarkComparison.benchmarkSchool}</div>
              <div className="mt-1 text-sm text-zinc-400">
                {preview.benchmarkComparison.source} · {preview.benchmarkComparison.benchmarkTier} · Elo{" "}
                {formatNumber(preview.benchmarkComparison.benchmarkElo)} · Avg field Elo{" "}
                {formatNumber(preview.avgSciolyElo)}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-black uppercase text-zinc-500">Event Rows</div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {preview.performances.map((performance, index) => (
                  <div key={`${performance.studentNames.join("-")}-${performance.eventName}-${index}`} className="rounded-md border border-court-line bg-court-elevated p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-white">{performance.studentNames.join(", ")}</div>
                      {performance.isMedal ? (
                        <span className="rounded border border-pink-300/40 bg-pink-300/10 px-2 py-1 text-[10px] font-black uppercase text-pink-200">
                          Medal
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-zinc-400">
                      {performance.eventName} · {performance.category} · Team {performance.teamDesignation} · #{performance.rank}
                    </div>
                    <div className="mt-2 text-xs font-bold text-cyan-300">
                      {performance.eventPoints} event pts · {performance.participationPoints} participation · {performance.medalPoints} medal
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {preview.warnings.length > 0 || preview.missingFields.length > 0 ? (
              <div className={cn("rounded-md border p-3 text-sm", preview.missingFields.length > 0 ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-court-line bg-court-elevated text-zinc-300")}>
                {[...preview.warnings, ...preview.missingFields].join(" ")}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-court-line bg-court-elevated p-4 text-sm text-zinc-500">
            Parse a CSV to inspect schools, medals, participants, SOS, and event points before committing.
          </div>
        )}
      </section>
    </div>
  );
}
