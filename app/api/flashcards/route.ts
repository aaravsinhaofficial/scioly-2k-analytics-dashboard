import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import { loadFlashcardDecks } from "@/lib/flashcard-data";
import type { FlashcardMutationResponse } from "@/lib/flashcard-types";
import { sciolyEvents } from "@/lib/resource-data";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const eventNames = new Set(sciolyEvents.map((event) => event.name));
const MAX_CARDS = 200;
const MAX_TOTAL_CARD_CHARACTERS = 300_000;

interface CardInput {
  front?: unknown;
  back?: unknown;
}

interface DeckInput {
  title?: unknown;
  description?: unknown;
  eventName?: unknown;
  cards?: unknown;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.normalize("NFKC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, maxLength)
    : "";
}

function validateInput(body: DeckInput) {
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 600);
  const eventName = cleanText(body.eventName, 120);
  if (!title || !eventNames.has(eventName)) return { error: "Choose an event and add a deck title." } as const;
  if (!Array.isArray(body.cards) || body.cards.length < 2 || body.cards.length > MAX_CARDS) {
    return { error: `A deck needs 2–${MAX_CARDS} cards.` } as const;
  }

  const cards = body.cards.map((entry, position) => {
    const row = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as CardInput : {};
    return {
      front: cleanText(row.front, 1000),
      back: cleanText(row.back, 5000),
      position,
    };
  });
  if (cards.some((card) => !card.front || !card.back)) return { error: "Every card needs a front and back." } as const;
  const totalCharacters = cards.reduce((sum, card) => sum + card.front.length + card.back.length, 0);
  if (totalCharacters > MAX_TOTAL_CARD_CHARACTERS) return { error: "This deck contains too much text." } as const;
  const normalizedFronts = cards.map((card) => card.front.toLocaleLowerCase());
  if (new Set(normalizedFronts).size !== normalizedFronts.length) {
    return { error: "Card fronts must be unique within a deck." } as const;
  }
  return { value: { title, description, eventName, cards } } as const;
}

async function member() {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return null;
  return currentUser;
}

export async function GET() {
  const currentUser = await member();
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in to view team flashcards." }, { status: 401 });
  return NextResponse.json(
    { ok: true, decks: await loadFlashcardDecks(currentUser) },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const currentUser = await member();
  if (!currentUser) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Sign in to publish flashcards." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 1_500_000) {
    return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "This deck is too large." }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Flashcard submissions must use JSON." }, { status: 415 });
  }
  const body = await request.json().catch(() => null) as DeckInput | null;
  const validated = validateInput(body ?? {});
  if ("error" in validated) {
    return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: validated.error }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Flashcard storage is not configured." }, { status: 503 });
    const now = new Date().toISOString();
    return NextResponse.json<FlashcardMutationResponse>({
      ok: true,
      persisted: false,
      message: "Preview mode: the deck is visible for this page session only.",
      deck: {
        id: `preview-${Date.now()}`,
        title: validated.value.title,
        description: validated.value.description,
        eventName: validated.value.eventName,
        authorName: currentUser.name,
        cardCount: validated.value.cards.length,
        score: 0,
        upvotes: 0,
        downvotes: 0,
        userVote: 0,
        isOwner: true,
        canModerate: true,
        createdAt: now,
      },
    });
  }

  const { data, error } = await supabase.rpc("publish_flashcard_deck", {
    p_author_id: currentUser.id,
    p_title: validated.value.title,
    p_description: validated.value.description,
    p_event_name: validated.value.eventName,
    p_cards: validated.value.cards,
  });
  if (error) {
    if (error.message.includes("FLASHCARD_DECK_LIMIT")) {
      return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "You can publish up to 10 decks in 24 hours." }, { status: 429 });
    }
    return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Could not publish this deck. Ask an administrator to apply the latest database schema." }, { status: 503 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Flashcard storage returned an invalid response." }, { status: 503 });
  }
  const deck = data as Record<string, unknown>;

  return NextResponse.json<FlashcardMutationResponse>({
    ok: true,
    message: "Deck published to the team.",
    deck: {
      id: String(deck.id),
      title: String(deck.title),
      description: String(deck.description ?? ""),
      eventName: String(deck.eventName),
      authorName: currentUser.name,
      cardCount: validated.value.cards.length,
      score: 0,
      upvotes: 0,
      downvotes: 0,
      userVote: 0,
      isOwner: true,
      canModerate: true,
      createdAt: String(deck.createdAt),
    },
  });
}
