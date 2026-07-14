"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ExternalLink, ListChecks, Loader2, Pencil, PlusCircle, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type {
  LibraryEventOption,
  LibraryItem,
  LibraryItemKind,
  LibraryMutationResponse,
} from "@/lib/library-types";
import { cn } from "@/lib/utils";

interface FormState {
  id?: number;
  updatedAt?: string;
  eventSlug: string;
  eventName: string;
  kind: LibraryItemKind;
  title: string;
  description: string;
  topic: string;
  difficulty: "Rookie" | "Pro" | "All-Star";
  resourceType: string;
  url: string;
  body: string;
  answer: string;
  explanation: string;
  testFormat: "Mini Test" | "Full Test" | "Testoff Set";
  isFeatured: boolean;
  isActive: boolean;
}

function blankForm(event?: LibraryEventOption): FormState {
  return {
    eventSlug: event?.slug ?? "",
    eventName: event?.name ?? "",
    kind: "resource",
    title: "",
    description: "",
    topic: "",
    difficulty: "Rookie",
    resourceType: "Guide",
    url: "",
    body: "",
    answer: "",
    explanation: "",
    testFormat: "Mini Test",
    isFeatured: false,
    isActive: true,
  };
}

function formFromItem(item: LibraryItem): FormState {
  return {
    id: item.id,
    updatedAt: item.updatedAt,
    eventSlug: item.eventSlug,
    eventName: item.eventName,
    kind: item.kind,
    title: item.title,
    description: item.description ?? "",
    topic: item.topic ?? "",
    difficulty: item.difficulty ?? "Rookie",
    resourceType: item.resourceType ?? "Guide",
    url: item.url ?? "",
    body: item.body ?? "",
    answer: item.answer ?? "",
    explanation: item.explanation ?? "",
    testFormat: item.testFormat ?? "Mini Test",
    isFeatured: item.isFeatured,
    isActive: item.isActive,
  };
}

function requestBody(form: FormState) {
  return {
    id: form.id,
    updatedAt: form.updatedAt,
    eventSlug: form.eventSlug,
    eventName: form.eventName,
    kind: form.kind,
    title: form.title,
    description: form.description,
    topic: form.topic,
    difficulty: form.difficulty,
    resourceType: form.resourceType,
    url: form.url,
    body: form.body,
    answer: form.answer,
    explanation: form.explanation,
    testFormat: form.testFormat,
    isFeatured: form.isFeatured,
    isActive: form.isActive,
  };
}

const kindLabels: Record<LibraryItemKind, string> = {
  resource: "Resource link",
  guide: "Guide text",
  question: "Quick question (answer reveal)",
  test: "Interactive practice test",
};

export function LibraryManager({
  initialItems,
  events,
  initialEvent,
  canModerate,
}: {
  initialItems: LibraryItem[];
  events: LibraryEventOption[];
  initialEvent?: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const initialOption = events.find((event) => event.slug === initialEvent) ?? events[0];
  const [items, setItems] = useState(initialItems);
  const [form, setForm] = useState<FormState>(() => blankForm(initialOption));
  const [eventFilter, setEventFilter] = useState(initialEvent ?? "all");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesEvent = eventFilter === "all" || item.eventSlug === eventFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.isActive : !item.isActive);
      const matchesQuery = !normalized || `${item.title} ${item.eventName} ${item.topic ?? ""} ${kindLabels[item.kind]}`.toLowerCase().includes(normalized);
      return matchesEvent && matchesStatus && matchesQuery;
    });
  }, [eventFilter, items, query, statusFilter]);

  function updateForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function chooseEvent(slug: string) {
    const event = events.find((option) => option.slug === slug);
    if (event) updateForm({ eventSlug: event.slug, eventName: event.name });
  }

  function resetForm(nextEventSlug = form.eventSlug) {
    const event = events.find((option) => option.slug === nextEventSlug) ?? events[0];
    setForm(blankForm(event));
    setError(null);
  }

  function save() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/library", {
          method: form.id ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody(form)),
        });
        const result = await response.json() as LibraryMutationResponse;
        if (!response.ok || !result.ok || !result.item) throw new Error(result.error ?? "Could not save this item.");
        const shouldOpenQuestionEditor = canModerate && !form.id && form.kind === "test" && result.persisted !== false;
        setItems((current) => form.id
          ? current.map((item) => item.id === result.item?.id ? result.item : item)
          : [result.item!, ...current]);
        setMessage(result.message ?? "Library item saved.");
        resetForm(result.item.eventSlug);
        setEventFilter(result.item.eventSlug);
        setStatusFilter("active");
        if (shouldOpenQuestionEditor) router.push(`/admin/library/tests/${result.item.id}`);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save this item.");
      }
    });
  }

  function remove(item: LibraryItem) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/library", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: item.id, updatedAt: item.updatedAt }),
        });
        const result = await response.json() as LibraryMutationResponse;
        if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not remove this item.");
        setItems((current) => current.map((entry) => entry.id === item.id ? result.item ?? { ...entry, isActive: false } : entry));
        setConfirmingId(null);
        setMessage(result.message ?? "Item removed.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not remove this item.");
      }
    });
  }

  function restore(item: LibraryItem) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/library", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...requestBody(formFromItem(item)), isActive: true }),
        });
        const result = await response.json() as LibraryMutationResponse;
        if (!response.ok || !result.ok || !result.item) throw new Error(result.error ?? "Could not restore this item.");
        setItems((current) => current.map((entry) => entry.id === item.id ? result.item! : entry));
        setMessage(result.message ?? "Item restored.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not restore this item.");
      }
    });
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <section className="min-w-0 rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-5" aria-labelledby="library-editor-heading">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-cyan-300">{form.id ? "Editing item" : canModerate ? "Add to the library" : "Member contribution"}</p>
            <h2 id="library-editor-heading" className="mt-1 text-xl font-semibold text-white">
              {form.id ? form.title : canModerate ? "New resource or practice" : "Share an event resource"}
            </h2>
          </div>
          {form.id ? (
            <button type="button" onClick={() => resetForm()} className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-court-line text-zinc-600 hover:bg-court-elevated hover:text-white" aria-label="Cancel editing">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid min-w-0 gap-4">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Event
            <select value={form.eventSlug} onChange={(event) => chooseEvent(event.target.value)} className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400">
              {events.map((event) => <option key={event.slug} value={event.slug}>{event.name}</option>)}
            </select>
          </label>

          {canModerate ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Item type
              <select value={form.kind} disabled={Boolean(form.id)} onChange={(event) => updateForm({ kind: event.target.value as LibraryItemKind })} className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
                {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {form.id ? <span className="text-xs font-normal text-zinc-500">Type is fixed after creation so attached questions and attempts stay valid.</span> : null}
            </label>
          ) : (
            <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm leading-6 text-zinc-600">
              Members can add resource links or readable notes. Officers manage edits, removals, guides, questions, and tests.
            </div>
          )}

          {form.kind === "test" ? (
            <div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm leading-6 text-zinc-600">
              Create the test first, then choose <span className="font-semibold text-white">Edit questions</span> to add interactive MCQs and free-response questions. A file link is optional.
            </div>
          ) : form.kind === "question" ? (
            <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm leading-6 text-zinc-600">
              This creates a short answer-reveal card. For scored MCQs or free responses, create an interactive practice test instead.
            </div>
          ) : null}

          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            {form.kind === "question" ? "Question" : "Title"}
            <input value={form.title} maxLength={240} onChange={(event) => updateForm({ title: event.target.value })} className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400" />
          </label>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Topic
              <input value={form.topic} maxLength={120} onChange={(event) => updateForm({ topic: event.target.value })} placeholder="e.g. Heat transfer" className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400" />
            </label>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Level
              <select value={form.difficulty} onChange={(event) => updateForm({ difficulty: event.target.value as FormState["difficulty"] })} className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400">
                <option>Rookie</option><option>Pro</option><option>All-Star</option>
              </select>
            </label>
          </div>

          {form.kind === "resource" ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Resource format
              <select value={form.resourceType} onChange={(event) => updateForm({ resourceType: event.target.value })} className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400">
                <option>Notes</option><option>Video</option><option>Cheat Sheet</option><option>Guide</option><option>Rules</option><option>Test</option>
              </select>
            </label>
          ) : null}

          {form.kind === "test" ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Test format
              <select value={form.testFormat} onChange={(event) => updateForm({ testFormat: event.target.value as FormState["testFormat"] })} className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400">
                <option>Mini Test</option><option>Full Test</option><option>Testoff Set</option>
              </select>
            </label>
          ) : null}

          {form.kind !== "question" ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Description
              <textarea value={form.description} maxLength={1200} rows={3} onChange={(event) => updateForm({ description: event.target.value })} className="w-full min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" />
            </label>
          ) : null}

          {form.kind === "resource" || form.kind === "test" ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              Link <span className="font-normal text-zinc-500">({form.kind === "test" ? "optional attachment" : "optional if you add text below"})</span>
              <input type="url" value={form.url} maxLength={1000} onChange={(event) => updateForm({ url: event.target.value })} placeholder="https://…" className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400" />
            </label>
          ) : null}

          {form.kind === "guide" || form.kind === "resource" || form.kind === "test" ? (
            <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
              {form.kind === "guide" ? "Guide text" : "Notes or instructions"}
              <textarea value={form.body} maxLength={20000} rows={6} onChange={(event) => updateForm({ body: event.target.value })} placeholder={form.kind === "guide" ? "Write the guide members should read…" : "Optional text members can read without leaving the site…"} className="w-full min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" />
            </label>
          ) : null}

          {form.kind === "question" ? (
            <>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
                Answer
                <textarea value={form.answer} maxLength={4000} rows={3} onChange={(event) => updateForm({ answer: event.target.value })} className="w-full min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
                Explanation
                <textarea value={form.explanation} maxLength={8000} rows={4} onChange={(event) => updateForm({ explanation: event.target.value })} className="w-full min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" />
              </label>
            </>
          ) : null}

          {canModerate ? (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-court-line bg-court-elevated px-3 text-sm text-zinc-600">
              <input type="checkbox" checked={form.isFeatured} onChange={(event) => updateForm({ isFeatured: event.target.checked })} className="h-4 w-4 accent-cyan-400" />
              Feature this item as a recommended starting point
            </label>
          ) : null}
        </div>

        <button type="button" onClick={save} disabled={isPending || !form.eventSlug || !form.title.trim()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : form.id ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
          {form.id ? "Save changes" : form.kind === "test" ? "Create interactive test" : "Add to library"}
        </button>
        {message ? <div className="mt-3 rounded-md border border-emerald-300/40 bg-emerald-300/10 p-3 text-sm text-emerald-300" role="status">{message}</div> : null}
        {error ? <div className="mt-3 rounded-md border border-red-300/40 bg-red-300/10 p-3 text-sm text-red-300" role="alert">{error}</div> : null}
      </section>

      <section className="min-w-0 rounded-md border border-court-line bg-court-panel shadow-sm" aria-labelledby="managed-library-heading">
        <div className="border-b border-court-line p-4 sm:p-5">
          <h2 id="managed-library-heading" className="text-xl font-semibold text-white">Managed library items</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{canModerate ? "Removed items stay here and can be restored. Static starter content is not changed." : "Active team contributions appear here. Officers handle edits and removals."}</p>
          <div className={cn("mt-4 grid min-w-0 gap-2", canModerate ? "md:grid-cols-[minmax(0,1fr)_180px_140px]" : "md:grid-cols-[minmax(0,1fr)_180px]") }>
            <label className="relative min-w-0">
              <span className="sr-only">Search managed items</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles or topics" className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel pl-9 pr-3 text-white outline-none focus:border-cyan-400" />
            </label>
            <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} aria-label="Filter managed items by event" className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400">
              <option value="all">All events</option>
              {events.map((event) => <option key={event.slug} value={event.slug}>{event.name}</option>)}
            </select>
            {canModerate ? (
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} aria-label="Filter managed items by status" className="h-11 w-full min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400">
                <option value="active">Active</option><option value="inactive">Removed</option><option value="all">All statuses</option>
              </select>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-3 p-4 sm:p-5 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <article key={item.id} className={cn("min-w-0 rounded-md border p-4", item.isActive ? "border-court-line bg-court-elevated" : "border-red-300/30 bg-red-300/5")}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-cyan-300">{item.eventName} · {kindLabels[item.kind]}</div>
                  <h3 className="mt-1 break-words font-semibold leading-6 text-white">{item.title}</h3>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-medium", item.isActive ? "bg-emerald-300/10 text-emerald-300" : "bg-red-300/10 text-red-300")}>{item.isActive ? "Active" : "Removed"}</span>
              </div>
              {item.description ? <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-zinc-500">{item.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                {item.topic ? <span>{item.topic}</span> : null}
                {item.difficulty ? <span>· {item.difficulty}</span> : null}
                {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:text-white"><ExternalLink className="h-3 w-3" /> Open</a> : null}
              </div>
              {canModerate ? <div className="mt-4 flex flex-wrap items-center gap-2">
                {item.kind === "test" ? (
                  <Link href={`/admin/library/tests/${item.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/20">
                    <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> Edit questions
                  </Link>
                ) : null}
                <button type="button" onClick={() => { setForm(formFromItem(item)); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-court-line px-3 text-xs font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </button>
                {item.isActive ? (
                  confirmingId === item.id ? (
                    <>
                      <button type="button" disabled={isPending} onClick={() => setConfirmingId(null)} className="min-h-10 rounded-md px-3 text-xs font-medium text-zinc-600 hover:bg-court-panel">Cancel</button>
                      <button type="button" disabled={isPending} onClick={() => remove(item)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-300/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-300/20"><Trash2 className="h-3.5 w-3.5" /> Confirm remove</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmingId(item.id)} className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-medium text-red-300 hover:bg-red-300/10"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                  )
                ) : (
                  <button type="button" disabled={isPending} onClick={() => restore(item)} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-300/10 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-300/20"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>
                )}
              </div> : null}
            </article>
          ))}
          {filteredItems.length === 0 ? (
            <div className="col-span-full rounded-md border border-dashed border-court-control px-5 py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-zinc-500" aria-hidden="true" />
              <p className="mt-3 font-medium text-white">No matching managed items</p>
              <p className="mt-1 text-sm text-zinc-500">Add the first item or change the filters.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
