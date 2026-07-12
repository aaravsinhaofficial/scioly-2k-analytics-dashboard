"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, PlusCircle } from "lucide-react";
import { activityHelp, activityLabels, calculateActivityPoints } from "@/lib/activity";
import type { ActivityType, CustomPointCategory, Student } from "@/lib/types";
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
  const [customLabel, setCustomLabel] = useState("Custom Practice");
  const [customCategories, setCustomCategories] = useState<CustomPointCategory[]>([]);
  const [customCategoryId, setCustomCategoryId] = useState<number | undefined>();
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const calculatedPoints = useMemo(
    () => calculateActivityPoints({ activityType, minutes, quantity, customPoints }),
    [activityType, customPoints, minutes, quantity]
  );
  const selectedCategory = customCategories.find((category) => category.id === customCategoryId);
  const points =
    activityType === "custom_activity" && selectedCategory
      ? Math.min(calculatedPoints, selectedCategory.maxPoints)
      : calculatedPoints;

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/admin/custom-categories", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; categories?: CustomPointCategory[]; error?: string }
          | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Could not load point categories.");
        if (cancelled) return;
        const categories = payload.categories ?? [];
        setCustomCategories(categories);
        const first = categories[0];
        if (first) {
          setCustomCategoryId(first.id);
          setCustomLabel(first.name);
          setCustomPoints(first.defaultPoints);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setCategoryLoadError(caught instanceof Error ? caught.message : "Could not load point categories.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function chooseCustomCategory(value: string) {
    if (value === "other") {
      setCustomCategoryId(undefined);
      setCustomLabel("Custom Practice");
      setCustomPoints(75);
      return;
    }

    const category = customCategories.find((entry) => entry.id === Number(value));
    if (!category) return;
    setCustomCategoryId(category.id);
    setCustomLabel(category.name);
    setCustomPoints(category.defaultPoints);
  }

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
            customPoints,
            customLabel: activityType === "custom_activity" ? customLabel : undefined,
            customCategoryId: activityType === "custom_activity" ? customCategoryId : undefined
          })
        });

        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Could not submit point log.");
        }
        setMessage(`${payload.message ?? payload.error ?? "Point log submitted."} View it in your submission history.`);
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : "Could not submit point log.");
      }
    });
  }

  return (
    <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm" aria-labelledby="log-practice-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="log-practice-heading" className="text-lg font-semibold text-white">Log practice</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-500">Your entry will be sent to an officer for approval.</p>
        </div>
        <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-right">
          <div className="text-xs font-medium text-cyan-300">If approved</div>
          <div className="text-xl font-semibold tabular-nums text-white">{formatNumber(points)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-2 text-sm font-medium text-zinc-600">
          Activity type
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
            className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
          >
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {activityLabels[type]} - {activityHelp[type]}
              </option>
            ))}
          </select>
        </label>

        {(activityType === "solo_study" || activityType === "partner_study" || activityType === "build_testing") && (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Time spent (minutes)
            <input
              type="number"
              min={0}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        )}

        {activityType === "id_specimens" ? (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Quantity
            <input
              type="number"
              min={0}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}

        {activityType === "custom_activity" ? (
          <>
            <label className="grid gap-2 text-sm font-medium text-zinc-600">
              Point Category
              <select
                value={customCategoryId ?? "other"}
                onChange={(event) => chooseCustomCategory(event.target.value)}
                className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
              >
                {customCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="other">Other / one-time activity</option>
              </select>
            </label>
            {selectedCategory ? (
              <div className="rounded-md bg-court-elevated p-3 text-xs text-zinc-500">
                Default {selectedCategory.defaultPoints} points · maximum {selectedCategory.maxPoints} points
              </div>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-zinc-600">
                Category Name
                <input
                  value={customLabel}
                  onChange={(event) => setCustomLabel(event.target.value)}
                  className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
              </label>
            )}
            {categoryLoadError ? <div className="text-xs text-amber-200">{categoryLoadError}</div> : null}
          </>
        ) : null}

        {activityType === "build_testing" || activityType === "custom_activity" ? (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Requested points
            <input
              type="number"
              min={0}
              max={activityType === "custom_activity" ? selectedCategory?.maxPoints ?? 500 : 200}
              value={customPoints}
              onChange={(event) => setCustomPoints(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || points <= 0}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
        Send for approval
      </button>

      {message ? <div className="mt-3 rounded-md bg-court-elevated p-3 text-sm text-zinc-600" role="status">{message}</div> : null}
    </section>
  );
}
