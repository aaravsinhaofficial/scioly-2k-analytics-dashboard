import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in to vote." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { value?: unknown } | null;
  const value = Number(body?.value);
  if (value !== -1 && value !== 0 && value !== 1) {
    return NextResponse.json({ ok: false, error: "Vote must be up, down, or cleared." }, { status: 400 });
  }
  if (isDemoMode() && (id.startsWith("preview-") || id === "demo-anatomy-respiratory")) {
    const isSampleDeck = id === "demo-anatomy-respiratory";
    const baseUpvotes = isSampleDeck ? 5 : 0;
    const baseDownvotes = isSampleDeck ? 1 : 0;
    const upvotes = baseUpvotes + (value === 1 ? 1 : 0);
    const downvotes = baseDownvotes + (value === -1 ? 1 : 0);
    return NextResponse.json({ ok: true, persisted: false, value, score: upvotes - downvotes, upvotes, downvotes });
  }
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false, error: "Deck not found." }, { status: 404 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "Flashcard storage is not configured." }, { status: 503 });
  const { data: deck, error: deckError } = await supabase
    .from("flashcard_decks")
    .select("id")
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();
  if (deckError || !deck) return NextResponse.json({ ok: false, error: "Deck not found." }, { status: 404 });

  const mutation = value === 0
    ? await supabase.from("flashcard_votes").delete().eq("deck_id", id).eq("student_id", currentUser.id)
    : await supabase.from("flashcard_votes").upsert(
        { deck_id: id, student_id: currentUser.id, value, updated_at: new Date().toISOString() },
        { onConflict: "deck_id,student_id" },
      );
  if (mutation.error) return NextResponse.json({ ok: false, error: "Could not save your vote." }, { status: 500 });
  const { data: votes, error: votesError } = await supabase.from("flashcard_votes").select("value").eq("deck_id", id);
  if (votesError) return NextResponse.json({ ok: false, error: "Vote saved, but the total could not be refreshed." }, { status: 500 });
  const values = (votes ?? []).map((vote) => Number(vote.value));
  const upvotes = values.filter((entry) => entry === 1).length;
  const downvotes = values.filter((entry) => entry === -1).length;
  return NextResponse.json({ ok: true, value, score: upvotes - downvotes, upvotes, downvotes });
}
