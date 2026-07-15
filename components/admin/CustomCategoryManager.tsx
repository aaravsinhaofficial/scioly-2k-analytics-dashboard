"use client";

import { useEffect, useState } from "react";
import { Archive, Loader2, Pencil, PlusCircle, RotateCcw, Save, X } from "lucide-react";
import type { CustomPointCategory } from "@/lib/types";

interface CategoryDraft {
  name: string;
  defaultPoints: number;
  maxPoints: number;
}

function draftFor(category: CustomPointCategory): CategoryDraft {
  return { name: category.name, defaultPoints: category.defaultPoints, maxPoints: category.maxPoints };
}

export function CustomCategoryManager() {
  const [categories, setCategories] = useState<CustomPointCategory[]>([]);
  const [name, setName] = useState("");
  const [defaultPoints, setDefaultPoints] = useState(50);
  const [maxPoints, setMaxPoints] = useState(500);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/custom-categories?includeInactive=true", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; categories?: CustomPointCategory[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not load point categories.");
      setCategories(payload.categories ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load point categories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  async function request(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, busy: string) {
    setBusyKey(busy);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/custom-categories", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json() as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not update this category.");
      setMessage(payload.message ?? "Category updated.");
      await loadCategories();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this category.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function createCategory() {
    if (
      busyKey === "create" ||
      !name.trim() ||
      !Number.isInteger(defaultPoints) ||
      defaultPoints < 1 ||
      defaultPoints > 500 ||
      !Number.isInteger(maxPoints) ||
      maxPoints < defaultPoints ||
      maxPoints > 500
    ) {
      setError("Enter a category name and a valid default and maximum point value.");
      return;
    }
    const saved = await request("POST", { name, defaultPoints, maxPoints }, "create");
    if (saved) {
      setName("");
      setDefaultPoints(50);
      setMaxPoints(500);
    }
  }

  async function saveCategory(category: CustomPointCategory, isActive = category.isActive) {
    if (!draft) return;
    const saved = await request("PATCH", { id: category.id, ...draft, isActive }, `category-${category.id}`);
    if (saved) {
      setEditingId(null);
      setDraft(null);
    }
  }

  async function deactivate(category: CustomPointCategory) {
    const saved = await request("DELETE", { id: category.id }, `category-${category.id}`);
    if (saved) setConfirmingId(null);
  }

  async function reactivate(category: CustomPointCategory) {
    setDraft(draftFor(category));
    const saved = await request("PATCH", { id: category.id, ...draftFor(category), isActive: true }, `category-${category.id}`);
    if (saved) setDraft(null);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-court-line bg-court-panel p-4 sm:p-5" aria-labelledby="custom-category-heading">
        <div>
          <h2 id="custom-category-heading" className="text-xl font-semibold text-white">Custom point categories</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">Create reusable activities for member point logs. Changes and deactivations can be undone from the audit log.</p>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void createCategory(); }} aria-busy={busyKey === "create" || undefined} className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_auto] xl:items-end">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">Name<input required value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Build iteration" className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" /></label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">Default points<input required type="number" min={1} max={500} value={defaultPoints} onChange={(event) => setDefaultPoints(Number(event.target.value))} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" /></label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">Maximum points<input required type="number" min={1} max={500} value={maxPoints} onChange={(event) => setMaxPoints(Number(event.target.value))} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" /></label>
          <button type="submit" disabled={busyKey === "create" || !name.trim() || !Number.isInteger(defaultPoints) || defaultPoints < 1 || defaultPoints > 500 || !Number.isInteger(maxPoints) || maxPoints < defaultPoints || maxPoints > 500} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 md:col-span-2 xl:col-span-1 xl:w-auto">
            {busyKey === "create" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />} {busyKey === "create" ? "Creating…" : "Create category"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-md border border-court-line bg-court-panel">
        <div className="flex flex-col gap-3 border-b border-court-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div><h2 id="saved-categories-heading" className="text-lg font-semibold text-white">Saved categories</h2><p className="mt-1 text-sm text-zinc-500">{categories.filter((category) => category.isActive).length} active · {categories.filter((category) => !category.isActive).length} inactive</p></div>
          <button type="button" onClick={() => void loadCategories()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white"><RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>
        </div>
        {message ? <div className="border-b border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300" role="status">{message}</div> : null}
        {error ? <div className="border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</div> : null}

        {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading categories…</div> : categories.length === 0 ? <div className="p-10 text-center text-sm text-zinc-500">No custom categories yet.</div> : (
          <div className="grid gap-3 p-4 lg:grid-cols-2 sm:p-5">
            {categories.map((category) => {
              const editing = editingId === category.id && draft;
              const busy = busyKey === `category-${category.id}`;
              return (
                <article key={category.id} className={`min-w-0 rounded-md border p-4 ${category.isActive ? "border-court-line bg-court-elevated" : "border-court-line bg-court-panel opacity-80"}`}>
                  {editing ? (
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 sm:col-span-2">Name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white" /></label>
                      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500">Default<input type="number" min={1} max={500} value={draft.defaultPoints} onChange={(event) => setDraft({ ...draft, defaultPoints: Number(event.target.value) })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white" /></label>
                      <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500">Maximum<input type="number" min={1} max={500} value={draft.maxPoints} onChange={(event) => setDraft({ ...draft, maxPoints: Number(event.target.value) })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white" /></label>
                    </div>
                  ) : (
                    <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-white">{category.name}</h3><p className="mt-1 text-sm text-zinc-500">Default {category.defaultPoints} · maximum {category.maxPoints} points</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${category.isActive ? "bg-emerald-300/10 text-emerald-300" : "bg-court-elevated text-zinc-500"}`}>{category.isActive ? "Active" : "Inactive"}</span></div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {editing ? <><button type="button" onClick={() => { setEditingId(null); setDraft(null); }} className="inline-flex items-center gap-2 rounded-md px-3 text-sm text-zinc-600"><X className="h-4 w-4" /> Cancel</button><button type="button" onClick={() => void saveCategory(category)} disabled={busy || !draft.name.trim() || draft.defaultPoints < 1 || draft.maxPoints < draft.defaultPoints || draft.maxPoints > 500} className="inline-flex items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-black"><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save"}</button></> : category.isActive ? <><button type="button" onClick={() => { setEditingId(category.id); setDraft(draftFor(category)); setConfirmingId(null); }} className="inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-court-panel hover:text-white"><Pencil className="h-4 w-4" /> Edit</button>{confirmingId === category.id ? <><button type="button" onClick={() => setConfirmingId(null)} className="rounded-md px-3 text-sm text-zinc-600">Cancel</button><button type="button" onClick={() => void deactivate(category)} disabled={busy} className="rounded-md bg-red-300/10 px-3 text-sm font-semibold text-red-300">{busy ? "Deactivating…" : "Confirm deactivate"}</button></> : <button type="button" onClick={() => setConfirmingId(category.id)} className="inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium text-red-300 hover:bg-red-300/10"><Archive className="h-4 w-4" /> Deactivate</button>}</> : <button type="button" onClick={() => void reactivate(category)} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white"><RotateCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Reactivate</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
