import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";

export async function recordFlashcardChange(entry: {
  action: "flashcard.publish" | "flashcard.remove" | "flashcard.vote";
  deckId: string;
  actorId?: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  // These records also advance /api/version so other open team pages refresh.
  // Do not store individual vote values or voters in the shared activity log.
  try {
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      action: entry.action,
      target: `Flashcard deck ${entry.deckId}`,
      reason: "Team flashcard library updated",
      entity_table: "flashcard_decks",
      entity_id: entry.deckId,
      is_reversible: false,
    });
    if (error) console.error("Could not record flashcard update", error.code);
  } catch {
    // A completed publish, removal or vote must not be reported as failed and
    // retried merely because the optional refresh notification could not save.
    console.error("Could not record flashcard update");
  }
}
