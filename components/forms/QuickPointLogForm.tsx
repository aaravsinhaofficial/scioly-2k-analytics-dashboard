"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, PlusCircle } from "lucide-react";
import { activityHelp, activityLabels, calculateActivityPoints } from "@/lib/activity";
import type { ActivityType, CustomPointCategory, Student } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface QuickPointLogFormProps {
  currentUser: Student;
}

const activityTypes = Object.keys(activityLabels) as ActivityType[];

export function QuickPointLogForm({ currentUser }: QuickPointLogFormProps) {
  const router = useRouter();
  const [activityType, setActivityType] = useState<ActivityType>("solo_study");
  const [minutes, setMinutes] = useState(60);
  const [quantity, setQuantity] = useState(50);
  const [customPoints, setCustomPoints] = useState(75);
  const [customLabel, setCustomLabel] = useState("Custom Practice");
  const [customCategories, setCustomCategories] = useState<CustomPointCategory[]>([]);
  const [customCategoryId, setCustomCategoryId] = useState<number | undefined>();
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formId = useId();

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
    setError(null);
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
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not submit point log.");
      }
    });
  }

  return (
    <details open className="group/disclosure min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm" aria-labelledby="log-practice-heading">
      <summary className="flex min-h-20 cursor-pointer list-none items-start justify-between gap-3 p-4 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400">
        <div className="min-w-0 flex-1">
          <h2 id="log-practice-heading" className="text-lg font-semibold text-white">Log practice</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-500">Your entry will be sent to an officer for approval.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-right">
            <div className="text-xs font-medium text-cyan-300">If approved</div>
            <div className="text-xl font-semibold tabular-nums text-white" aria-live="polite">{formatNumber(points)} <span className="sr-only">points</span></div>
          </div>
          <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform duration-200 group-open/disclosure:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <form className="grid gap-3 border-t border-court-line p-4" aria-busy={isPending} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
          Activity type
          <select
            value={activityType}
            onChange={(event) => { setActivityType(event.target.value as ActivityType); setMessage(null); setError(null); }}
            aria-describedby={`${formId}-activity-help`}
            className="h-11 w-full min-w-0 max-w-full rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
          >
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {activityLabels[type]}
              </option>
            ))}
          </select>
          <span id={`${formId}-activity-help`} className="text-xs font-normal leading-5 text-zinc-500">{activityHelp[activityType]}</span>
        </label>

        {(activityType === "solo_study" || activityType === "partner_study" || activityType === "build_testing") && (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Time spent (minutes)
            <input
              type="number"
              min={0}
              required
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
              required
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
            {categoryLoadError ? <div className="text-xs text-amber-200" role="alert">{categoryLoadError}</div> : null}
          </>
        ) : null}

        {activityType === "build_testing" || activityType === "custom_activity" ? (
          <label className="grid gap-2 text-sm font-medium text-zinc-600">
            Requested points
            <input
            type="number"
            min={0}
            required
              max={activityType === "custom_activity" ? selectedCategory?.maxPoints ?? 500 : 200}
              value={customPoints}
              onChange={(event) => setCustomPoints(Number(event.target.value))}
              className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={isPending || points <= 0}
          className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
          Send for approval
        </button>

        {message ? <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200" role="status">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200" role="alert">{error}</div> : null}
      </form>
    </details>
  );
}
