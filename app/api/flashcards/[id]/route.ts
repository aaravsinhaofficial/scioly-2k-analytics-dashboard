import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import type { FlashcardMutationResponse } from "@/lib/flashcard-types";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Sign in to remove a deck." }, { status: 401 });
  const { id } = await params;
  if (isDemoMode() && (id.startsWith("preview-") || id === "demo-anatomy-respiratory")) {
    return NextResponse.json<FlashcardMutationResponse>({ ok: true, persisted: false, message: "Preview deck removed from this page session." });
  }
  if (!uuidPattern.test(id)) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Deck not found." }, { status: 404 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Flashcard storage is not configured." }, { status: 503 });
  const { data: deck, error: loadError } = await supabase.from("flashcard_decks").select("author_id").eq("id", id).maybeSingle();
  if (loadError || !deck) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Deck not found." }, { status: 404 });
  if (String(deck.author_id) !== currentUser.id && !roleMeets(currentUser.role, "officer")) {
    return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Only the author or an officer can remove this deck." }, { status: 403 });
  }
  const { error } = await supabase.from("flashcard_decks").delete().eq("id", id);
  if (error) return NextResponse.json<FlashcardMutationResponse>({ ok: false, error: "Could not remove this deck." }, { status: 500 });
  return NextResponse.json<FlashcardMutationResponse>({ ok: true, message: "Deck removed." });
}
