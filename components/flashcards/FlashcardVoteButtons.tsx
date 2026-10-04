"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import type { FlashcardDeckSummary } from "@/lib/flashcard-types";
import { cn } from "@/lib/utils";

interface FlashcardVoteButtonsProps {
  deck: Pick<FlashcardDeckSummary, "id" | "score" | "upvotes" | "downvotes" | "userVote">;
  onChange?: (value: Pick<FlashcardDeckSummary, "score" | "upvotes" | "downvotes" | "userVote">) => void;
}

export function FlashcardVoteButtons({ deck, onChange }: FlashcardVoteButtonsProps) {
  const [vote, setVote] = useState(deck.userVote);
  const [score, setScore] = useState(deck.score);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(next: -1 | 1) {
    if (busy) return;
    const requested = vote === next ? 0 : next;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/flashcards/${deck.id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: requested }),
      });
      const payload = await response.json() as {
        ok?: boolean;
        error?: string;
        value?: -1 | 0 | 1;
        score?: number;
        upvotes?: number;
        downvotes?: number;
      };
      if (!response.ok || !payload.ok || payload.value === undefined || payload.score === undefined) {
        throw new Error(payload.error ?? "Could not save your vote.");
      }
      setVote(payload.value);
      setScore(payload.score);
      onChange?.({
        userVote: payload.value,
        score: payload.score,
        upvotes: payload.upvotes ?? deck.upvotes,
        downvotes: payload.downvotes ?? deck.downvotes,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your vote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="inline-flex items-center overflow-hidden rounded-md border border-court-line bg-court-elevated">
        <button
          type="button"
          onClick={() => choose(1)}
          disabled={busy}
          aria-label="Upvote deck"
          aria-pressed={vote === 1}
          className={cn("grid h-10 w-10 place-items-center text-zinc-500 hover:text-emerald-300 disabled:opacity-50", vote === 1 && "bg-emerald-300/10 text-emerald-300")}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="min-w-10 border-x border-court-line px-2 text-center text-sm font-semibold text-white" aria-label={`Vote score ${score}`}>{score}</span>
        <button
          type="button"
          onClick={() => choose(-1)}
          disabled={busy}
          aria-label="Downvote deck"
          aria-pressed={vote === -1}
          className={cn("grid h-10 w-10 place-items-center text-zinc-500 hover:text-red-300 disabled:opacity-50", vote === -1 && "bg-red-300/10 text-red-300")}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error ? <p className="mt-1 max-w-48 text-xs text-red-300" role="alert">{error}</p> : null}
    </div>
  );
}
