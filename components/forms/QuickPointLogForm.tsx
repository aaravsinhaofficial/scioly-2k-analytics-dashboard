"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import { activityHelp, activityLabels, calculateActivityPoints } from "@/lib/activity";
import type { ActivityType, Student } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface QuickPointLogFormProps {
  currentUser: Student;
}

const activityTypes = Object.keys(activityLabels) as ActivityType[];

export function QuickPointLogForm({ currentUser }: QuickPointLogFormProps) {
  const [activityType, setActivityType] = useState<ActivityType>("solo_study");
  const [minutes, setMinutes] = useState(60);
  const [quantity, setQuantity] = useState(50);
  const [customPoints, setCustomPoints] = useState(75);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const points = useMemo(
    () => calculateActivityPoints({ activityType, minutes, quantity, customPoints }),
    [activityType, customPoints, minutes, quantity]
  );

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: currentUser.id,
            activityType,
            minutes,
            quantity,
            customPoints
          })
        });

        if (!response.ok) {
          throw new Error("Point API unavailable");
        }

        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
        setMessage(payload.message ?? payload.error ?? "Point log submitted.");
      } catch {
        setMessage(
          `Static demo: ${points} points staged locally. Deploy with Supabase or Vercel-style APIs to persist approvals.`
        );
      }
    });
  }

  return (
    <div className="rounded-md border border-court-line bg-court-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black italic uppercase text-white">Quick Add</h2>
          <p className="mt-1 text-sm text-zinc-400">Logs enter the officer queue before changing OVR.</p>
        </div>
        <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-right">
          <div className="text-[10px] font-black uppercase text-cyan-200">Points</div>
          <div className="text-2xl font-black italic text-white">{formatNumber(points)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
          Activity
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
            className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
          >
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {activityLabels[type]} - {activityHelp[type]}
              </option>
            ))}
          </select>
        </label>

        {(activityType === "solo_study" || activityType === "partner_study" || activityType === "build_testing") && (
          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Minutes
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        )}

        {activityType === "id_specimens" ? (
          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Quantity
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}

        {activityType === "build_testing" ? (
          <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
            Custom Points
            <input
              type="number"
              min={0}
              value={customPoints}
              onChange={(event) => setCustomPoints(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || points <= 0}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
        Submit Log
      </button>

      {message ? <div className="mt-3 rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}
    </div>
  );
}
