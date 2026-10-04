"use client";

import { ChevronLeft, ChevronRight, Copy, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlashcardVoteButtons } from "@/components/flashcards/FlashcardVoteButtons";
import type { FlashcardDeck, FlashcardMutationResponse } from "@/lib/flashcard-types";

export function FlashcardStudy({ deck }: { deck: FlashcardDeck }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState("");
  const card = deck.cards[index];

  function move(direction: -1 | 1) {
    setIndex((current) => (current + direction + deck.cards.length) % deck.cards.length);
    setRevealed(false);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, button, a, [contenteditable='true']")
      ) return;
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setRevealed((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deck.cards.length]);

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Share link copied.");
    } catch {
      setMessage(url);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove “${deck.title}” from the team library?`)) return;
    const response = await fetch(`/api/flashcards/${deck.id}`, { method: "DELETE" });
    const payload = await response.json() as FlashcardMutationResponse;
    if (!response.ok || !payload.ok) {
      setMessage(payload.error ?? "Could not remove this deck.");
      return;
    }
    router.push("/flashcards");
    router.refresh();
  }

  if (!card) return <div className="rounded-md border border-court-line bg-court-panel p-8 text-zinc-500">This deck has no cards.</div>;

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-cyan-300">{deck.eventName}</div>
            <h2 className="mt-1 text-xl font-semibold text-white">{deck.title}</h2>
            <p className="mt-2 text-sm text-zinc-500">{deck.description || "Team-created review deck."}</p>
            <p className="mt-2 text-xs text-zinc-500">{deck.cardCount} cards · By {deck.authorName}</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <FlashcardVoteButtons deck={deck} />
            <button type="button" onClick={share} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-court-line px-3 text-sm font-semibold text-cyan-300 hover:border-cyan-400"><Copy className="h-4 w-4" /> Share</button>
            {deck.canModerate ? <button type="button" onClick={remove} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300/30 px-3 text-sm font-semibold text-red-300 hover:bg-red-300/10"><Trash2 className="h-4 w-4" /> Remove</button> : null}
          </div>
        </div>
        {message ? <p className="mt-3 break-all text-xs text-emerald-300" role="status">{message}</p> : null}
      </section>

      <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3 text-sm text-zinc-500">
          <span>Card {index + 1} of {deck.cards.length}</span>
          <span>{revealed ? "Answer" : "Prompt"}</span>
        </div>
        <button type="button" onClick={() => setRevealed((current) => !current)} className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-md border border-court-control bg-court-elevated p-6 text-center transition-colors hover:border-cyan-400 sm:p-10">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{revealed ? "Back" : "Front"}</span>
          <span className="mt-5 whitespace-pre-wrap text-xl font-semibold leading-8 text-white sm:text-2xl">{revealed ? card.back : card.front}</span>
          <span className="mt-8 text-xs text-zinc-500">Click or press Space to flip</span>
        </button>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={() => move(-1)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400"><ChevronLeft className="h-4 w-4" /> Previous</button>
          <button type="button" onClick={() => { setIndex(0); setRevealed(false); }} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-zinc-500 hover:bg-court-elevated hover:text-white"><RotateCcw className="h-4 w-4" /> Restart</button>
          <button type="button" onClick={() => move(1)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400">Next <ChevronRight className="h-4 w-4" /></button>
        </div>
      </section>
    </div>
  );
}
