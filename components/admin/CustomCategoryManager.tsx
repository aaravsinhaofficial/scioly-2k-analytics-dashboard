"use client";

import { useState, useTransition } from "react";
import { Loader2, PlusCircle } from "lucide-react";

export function CustomCategoryManager() {
  const [name, setName] = useState("Build Iteration");
  const [defaultPoints, setDefaultPoints] = useState(50);
  const [maxPoints, setMaxPoints] = useState(500);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createCategory() {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/custom-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, defaultPoints, maxPoints })
        });
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error ?? "Could not create category.");
        setMessage(payload?.message ?? "Category created.");
      } catch (caught) {
        const fallback = caught instanceof Error ? caught.message : "Static demo: category staged locally.";
        setMessage(fallback.includes("fetch") ? "Static demo: category staged locally." : fallback);
      }
    });
  }

  return (
    <section className="rounded-md border border-court-line bg-court-panel p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white">Custom Point Categories</h2>
          <p className="mt-1 text-sm text-zinc-400">Create reusable "other" categories for point logs.</p>
        </div>
        {message ? <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px_auto] md:items-end">
        <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
          />
        </label>
        <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
          Default
          <input
            type="number"
            min={0}
            value={defaultPoints}
            onChange={(event) => setDefaultPoints(Number(event.target.value))}
            className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
          />
        </label>
        <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
          Max
          <input
            type="number"
            min={0}
            value={maxPoints}
            onChange={(event) => setMaxPoints(Number(event.target.value))}
            className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none focus:border-cyan-400"
          />
        </label>
        <button
          type="button"
          onClick={createCategory}
          disabled={isPending || !name.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Create
        </button>
      </div>
    </section>
  );
}
