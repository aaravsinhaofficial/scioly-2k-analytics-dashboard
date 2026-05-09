"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles, Upload } from "lucide-react";
import type { TournamentImportPreview } from "@/lib/types";
import { buildStaticTournamentPreview } from "@/lib/static-tournament-import";
import { cn, formatNumber } from "@/lib/utils";

const sampleInput = `Texas State Tournament
2026-04-19
Schools: Obra D Tompkins High School; Seven Lakes High School; Clements High School; LASA High School
Anatomy & Physiology: Samanyu Pochanapeddi A 2
Tower: Nisha Patel A 4
Disease Detectives: Aarav Shah A 7
Robot Tour: Ethan Morales B 10`;

export function TournamentUpload() {
  const [rawInput, setRawInput] = useState(sampleInput);
  const [preview, setPreview] = useState<TournamentImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function parse(commit = false) {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/tournaments/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawInput, commit })
        });

        if (!response.ok) {
          throw new Error("Tournament import API unavailable");
        }

        const payload = (await response.json()) as {
          ok: boolean;
          preview?: TournamentImportPreview;
          message?: string;
          error?: string;
        };
        if (payload.preview) {
          setPreview(payload.preview);
        }
        setMessage(payload.message ?? payload.error ?? null);
      } catch {
        const staticPreview = buildStaticTournamentPreview(rawInput);
        setPreview(staticPreview);
        setMessage(
          commit
            ? "Static demo: import preview staged locally. GitHub Pages cannot write tournament data without a backend."
            : "Static demo: parsed locally. OpenAI extraction runs when deployed with a server API."
        );
      }
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <section className="rounded-md border border-court-line bg-court-panel">
        <div className="border-b border-court-line p-5">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Magic Box
          </div>
          <h2 className="mt-1 text-2xl font-black italic uppercase text-white">Tournament Import</h2>
        </div>
        <div className="p-5">
          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            rows={16}
            className="w-full resize-y rounded-md border border-court-line bg-court-elevated p-4 font-mono text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-400"
            placeholder="Paste Duosmium YAML, Scio.ly URL, spreadsheet text, or official result text"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => parse(false)}
              disabled={isPending || rawInput.trim().length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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
              onClick={() => setRawInput(sampleInput)}
              className="inline-flex h-11 items-center justify-center rounded-md border border-court-line px-4 text-sm font-black uppercase text-zinc-300 transition hover:border-white hover:text-white"
            >
              Sample
            </button>
          </div>
          {message ? <div className="mt-4 rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}
        </div>
      </section>

      <section className="rounded-md border border-court-line bg-court-panel p-5">
        <h2 className="text-xl font-black italic uppercase text-white">Preview</h2>
        {preview ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-court-line bg-court-elevated p-4">
              <div className="text-xs font-black uppercase text-zinc-500">Tournament</div>
              <div className="mt-1 text-xl font-black text-white">{preview.tournamentName}</div>
              <div className="mt-2 text-sm text-zinc-400">{preview.date}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-court-line bg-court-elevated p-4">
                <div className="text-xs font-black uppercase text-zinc-500">SOS</div>
                <div className="mt-1 text-3xl font-black italic text-cyan-300">{preview.sosMultiplier.toFixed(2)}x</div>
              </div>
              <div className="rounded-md border border-court-line bg-court-elevated p-4">
                <div className="text-xs font-black uppercase text-zinc-500">Relative</div>
                <div className="mt-1 text-3xl font-black italic text-white">
                  {preview.benchmarkComparison.relativeDifficultyMultiplier.toFixed(2)}x
                </div>
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
              <div className="mt-2 text-xs text-zinc-500">{preview.benchmarkComparison.explanation}</div>
            </div>
            <div>
              <div className="mb-2 text-xs font-black uppercase text-zinc-500">Placements</div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {preview.performances.map((performance, index) => (
                  <div key={`${performance.studentName}-${performance.eventName}-${index}`} className="rounded-md border border-court-line bg-court-elevated p-3 text-sm">
                    <div className="font-black text-white">{performance.studentName}</div>
                    <div className="mt-1 text-zinc-400">
                      {performance.eventName} · {performance.category} · Team {performance.teamDesignation} · #{performance.rank}
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
            Paste results and parse to inspect extracted schools, SOS, and placements before committing.
          </div>
        )}
      </section>
    </div>
  );
}
