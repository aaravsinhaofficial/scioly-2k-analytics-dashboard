import "server-only";

import { getEventKnowledge } from "@/lib/event-content";
import type { FlashcardCard, FlashcardDeck, FlashcardDeckSummary } from "@/lib/flashcard-types";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import type { Student } from "@/lib/types";
import { roleMeets } from "@/lib/utils";

interface DeckRow {
  id: string;
  title: string;
  description: string | null;
  event_name: string;
  author_id: string;
  created_at: string;
}

interface CardRow {
  id: number | string;
  deck_id: string;
  front: string;
  back: string;
  position: number;
}

interface VoteRow {
  deck_id: string;
  student_id: string;
  value: number;
}

interface CardCountRow {
  deck_id: string;
  card_count: number | string;
}

function demoDeck(currentUser: Student): FlashcardDeck {
  const cards = getEventKnowledge("Anatomy and Physiology").slice(0, 8).map((item, position) => ({
    position,
    front: item.term,
    back: `${item.definition} ${item.mechanism}`,
  }));
  return {
    id: "demo-anatomy-respiratory",
    title: "Anatomy: systems content check",
    description: "A sample team deck showing the study and voting experience.",
    eventName: "Anatomy and Physiology",
    authorName: "Preview member",
    cardCount: cards.length,
    score: 4,
    upvotes: 5,
    downvotes: 1,
    userVote: 0,
    isOwner: false,
    canModerate: roleMeets(currentUser.role, "officer"),
    createdAt: "2026-09-30T00:00:00.000Z",
    cards,
  };
}

function summarize(
  row: DeckRow,
  currentUser: Student,
  authors: Map<string, string>,
  cardCounts: Map<string, number>,
  votes: VoteRow[],
): FlashcardDeckSummary {
  const deckVotes = votes.filter((vote) => vote.deck_id === row.id);
  const upvotes = deckVotes.filter((vote) => vote.value === 1).length;
  const downvotes = deckVotes.filter((vote) => vote.value === -1).length;
  const ownVote = deckVotes.find((vote) => vote.student_id === currentUser.id)?.value ?? 0;
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    eventName: row.event_name,
    authorName: authors.get(row.author_id) ?? "Team member",
    cardCount: cardCounts.get(row.id) ?? 0,
    score: upvotes - downvotes,
    upvotes,
    downvotes,
    userVote: ownVote === 1 ? 1 : ownVote === -1 ? -1 : 0,
    isOwner: row.author_id === currentUser.id,
    canModerate: row.author_id === currentUser.id || roleMeets(currentUser.role, "officer"),
    createdAt: row.created_at,
  };
}

async function supportingRows(deckRows: DeckRow[]) {
  const supabase = getSupabaseAdmin();
  if (!supabase || deckRows.length === 0) {
    return { cardCounts: new Map<string, number>(), votes: [] as VoteRow[], authors: new Map<string, string>() };
  }
  const ids = deckRows.map((deck) => deck.id);
  const authorIds = Array.from(new Set(deckRows.map((deck) => deck.author_id)));
  const [countResult, voteResult, authorResult] = await Promise.all([
    supabase.rpc("flashcard_deck_card_counts", { p_deck_ids: ids }),
    supabase.from("flashcard_votes").select("deck_id,student_id,value").in("deck_id", ids),
    supabase.from("students").select("id,name").in("id", authorIds),
  ]);
  const countRows = countResult.error ? [] : (countResult.data ?? []) as CardCountRow[];
  return {
    cardCounts: new Map(countRows.map((row) => [String(row.deck_id), Number(row.card_count)])),
    votes: voteResult.error ? [] as VoteRow[] : (voteResult.data ?? []) as VoteRow[],
    authors: authorResult.error
      ? new Map<string, string>()
      : new Map((authorResult.data ?? []).map((author) => [String(author.id), String(author.name)])),
  };
}

export async function loadFlashcardDecks(currentUser: Student): Promise<FlashcardDeckSummary[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return isDemoMode() ? [demoDeck(currentUser)] : [];

  const { data, error } = await supabase
    .from("flashcard_decks")
    .select("id,title,description,event_name,author_id,created_at")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const rows = data as DeckRow[];
  const related = await supportingRows(rows);
  return rows.map((row) => summarize(row, currentUser, related.authors, related.cardCounts, related.votes));
}

export async function loadFlashcardDeck(deckId: string, currentUser: Student): Promise<FlashcardDeck | null> {
  if (deckId === "demo-anatomy-respiratory" && isDemoMode()) return demoDeck(currentUser);
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("flashcard_decks")
    .select("id,title,description,event_name,author_id,created_at")
    .eq("id", deckId)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as DeckRow;
  const [related, cardResult] = await Promise.all([
    supportingRows([row]),
    supabase.from("flashcards").select("id,deck_id,front,back,position").eq("deck_id", row.id).order("position"),
  ]);
  if (cardResult.error) return null;
  const cards: FlashcardCard[] = ((cardResult.data ?? []) as CardRow[])
    .sort((left, right) => left.position - right.position)
    .map((card) => ({ id: Number(card.id), front: card.front, back: card.back, position: card.position }));
  related.cardCounts.set(row.id, cards.length);
  const summary = summarize(row, currentUser, related.authors, related.cardCounts, related.votes);
  return { ...summary, cards };
}
