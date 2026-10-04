"use client";

import { FileUp, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { FlashcardVoteButtons } from "@/components/flashcards/FlashcardVoteButtons";
import { cardsFromCsv } from "@/lib/flashcard-csv";
import type { FlashcardDeckSummary, FlashcardMutationResponse } from "@/lib/flashcard-types";

interface EditableCard {
  front: string;
  back: string;
}

interface FlashcardHubProps {
  initialDecks: FlashcardDeckSummary[];
  eventNames: string[];
}

function emptyCards(): EditableCard[] {
  return [{ front: "", back: "" }, { front: "", back: "" }];
}

export function FlashcardHub({ initialDecks, eventNames }: FlashcardHubProps) {
  const [decks, setDecks] = useState(initialDecks);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventName, setEventName] = useState(eventNames[0] ?? "");
  const [cards, setCards] = useState<EditableCard[]>(emptyCards);
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("All events");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return decks.filter((deck) =>
      (eventFilter === "All events" || deck.eventName === eventFilter)
      && (!normalized || `${deck.title} ${deck.description} ${deck.eventName} ${deck.authorName}`.toLocaleLowerCase().includes(normalized))
    );
  }, [decks, eventFilter, query]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setEventName(eventNames[0] ?? "");
    setCards(emptyCards());
    setError("");
  }

  async function importCsv(file: File | undefined) {
    if (!file) return;
    setError("");
    setStatus("");
    if (file.size > 1024 * 1024) {
      setError("CSV files must be 1 MB or smaller.");
      return;
    }
    try {
      const imported = cardsFromCsv(await file.text());
      setCards(imported);
      if (!title) setTitle(file.name.replace(/\.csv$/i, "").slice(0, 120));
      setStatus(`${imported.length} cards imported. The CSV stays in your browser and is not uploaded as a file.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read this CSV.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateCard(index: number, field: keyof EditableCard, value: string) {
    setCards((current) => current.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: value } : card));
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description, eventName, cards }),
      });
      const payload = await response.json() as FlashcardMutationResponse;
      if (!response.ok || !payload.ok || !payload.deck) throw new Error(payload.error ?? "Could not publish this deck.");
      setDecks((current) => [payload.deck!, ...current]);
      setStatus(payload.message ?? "Deck published.");
      resetForm();
      setCreating(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish this deck.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDeck(deck: FlashcardDeckSummary) {
    if (!window.confirm(`Remove “${deck.title}” from the team library?`)) return;
    setError("");
    const response = await fetch(`/api/flashcards/${deck.id}`, { method: "DELETE" });
    const payload = await response.json() as FlashcardMutationResponse;
    if (!response.ok || !payload.ok) {
      setError(payload.error ?? "Could not remove this deck.");
      return;
    }
    setDecks((current) => current.filter((entry) => entry.id !== deck.id));
    setStatus(payload.message ?? "Deck removed.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <label className="grid gap-2 text-sm font-medium text-zinc-500">
              Search decks
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-md border border-court-control bg-court-elevated pl-10 pr-3 text-white outline-none focus:border-cyan-400" placeholder="Title, event, or author" />
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-500">
              Event
              <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="min-h-11 rounded-md border border-court-control bg-court-elevated px-3 text-white outline-none focus:border-cyan-400">
                <option>All events</option>
                {eventNames.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={() => { setCreating((current) => !current); setError(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
            {creating ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {creating ? "Close creator" : "Create a deck"}
          </button>
        </div>
      </section>

      {creating ? (
        <form onSubmit={publish} className="rounded-md border border-cyan-400/40 bg-court-panel p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Publish team flashcards</h2>
              <p className="mt-1 text-sm text-zinc-500">Type cards below or import a CSV with <strong className="font-medium text-zinc-300">front,back</strong> columns.</p>
            </div>
            <div>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} className="sr-only" id="flashcard-csv" />
              <label htmlFor="flashcard-csv" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white">
                <FileUp className="h-4 w-4" aria-hidden="true" /> Import CSV
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-zinc-500">Deck title<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 rounded-md border border-court-control bg-court-elevated px-3 text-white outline-none focus:border-cyan-400" placeholder="Respiratory system review" /></label>
            <label className="grid gap-2 text-sm font-medium text-zinc-500">Event<select required value={eventName} onChange={(event) => setEventName(event.target.value)} className="min-h-11 rounded-md border border-court-control bg-court-elevated px-3 text-white outline-none focus:border-cyan-400">{eventNames.map((name) => <option key={name}>{name}</option>)}</select></label>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-500">Description <span className="font-normal">(optional)</span><textarea maxLength={600} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className="resize-y rounded-md border border-court-control bg-court-elevated p-3 text-white outline-none focus:border-cyan-400" placeholder="What this deck covers" /></label>

          <div className="mt-5 space-y-3">
            {cards.map((card, index) => (
              <div key={index} className="grid gap-3 rounded-md border border-court-line bg-court-elevated p-3 md:grid-cols-[36px_minmax(0,1fr)_minmax(0,1.5fr)_44px] md:items-start">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-court-panel text-sm font-semibold text-zinc-500">{index + 1}</span>
                <label className="grid gap-1.5 text-xs font-medium text-zinc-500">Front<textarea required maxLength={1000} rows={3} value={card.front} onChange={(event) => updateCard(index, "front", event.target.value)} className="resize-y rounded-md border border-court-control bg-court-panel p-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
                <label className="grid gap-1.5 text-xs font-medium text-zinc-500">Back<textarea required maxLength={5000} rows={3} value={card.back} onChange={(event) => updateCard(index, "back", event.target.value)} className="resize-y rounded-md border border-court-control bg-court-panel p-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
                <button type="button" disabled={cards.length <= 2} onClick={() => setCards((current) => current.filter((_, cardIndex) => cardIndex !== index))} className="grid h-11 w-11 place-items-center rounded-md text-zinc-500 hover:bg-red-300/10 hover:text-red-300 disabled:opacity-30" aria-label={`Remove card ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={cards.length >= 200} onClick={() => setCards((current) => [...current, { front: "", back: "" }])} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400"><Plus className="h-4 w-4" /> Add card</button>
            <span className="text-sm text-zinc-500">{cards.length}/200 cards</span>
            <button type="submit" disabled={busy} className="ml-auto inline-flex min-h-11 items-center justify-center rounded-md bg-cyan-300 px-5 text-sm font-semibold text-black hover:bg-cyan-200 disabled:opacity-50">{busy ? "Publishing…" : "Publish to team"}</button>
          </div>
          <p className="mt-4 text-xs leading-5 text-zinc-500">CSV files are parsed as text in your browser; the original file is not uploaded. Publish only material you created or may share, and do not include private information or copyrighted test banks.</p>
        </form>
      ) : null}

      {status ? <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200" role="status">{status}</div> : null}
      {error ? <div className="rounded-md border border-red-300/30 bg-red-300/10 px-4 py-3 text-sm text-red-200" role="alert">{error}</div> : null}

      {filtered.length ? (
        <section className="grid gap-4 lg:grid-cols-2" aria-label="Shared flashcard decks">
          {filtered.map((deck) => (
            <article key={deck.id} className="rounded-md border border-court-line bg-court-panel p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-cyan-300">{deck.eventName}</div>
                  {deck.id.startsWith("preview-") ? <h2 className="mt-1 text-lg font-semibold text-white">{deck.title}</h2> : <Link href={`/flashcards/${deck.id}`} className="mt-1 block text-lg font-semibold text-white hover:text-cyan-300">{deck.title}</Link>}
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{deck.description || "Team-created review deck."}</p>
                </div>
                <FlashcardVoteButtons deck={deck} onChange={(vote) => setDecks((current) => current.map((entry) => entry.id === deck.id ? { ...entry, ...vote } : entry))} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-court-line pt-4 text-xs text-zinc-500">
                <span>{deck.cardCount} cards</span><span aria-hidden="true">·</span><span>By {deck.authorName}</span><span aria-hidden="true">·</span><span>{new Date(deck.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</span>
                {deck.id.startsWith("preview-") ? <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-200">Preview only</span> : <Link href={`/flashcards/${deck.id}`} className="font-semibold text-cyan-300 hover:text-white">Study deck →</Link>}
                {deck.canModerate ? <button type="button" onClick={() => removeDeck(deck)} className="ml-auto text-red-300 hover:text-red-200">Remove</button> : null}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-md border border-court-line bg-court-panel px-4 py-12 text-center"><h2 className="font-semibold text-white">No matching decks</h2><p className="mt-1 text-sm text-zinc-500">Create the first deck or change the filters.</p></div>
      )}
    </div>
  );
}
