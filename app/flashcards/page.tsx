import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { FlashcardHub } from "@/components/flashcards/FlashcardHub";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { getCurrentUser } from "@/lib/data";
import { loadFlashcardDecks } from "@/lib/flashcard-data";
import { sciolyEvents } from "@/lib/resource-data";

export const metadata: Metadata = { title: "Team Flashcards" };
export const dynamic = "force-dynamic";

export default async function FlashcardsPage() {
  const currentUser = await getCurrentUser();
  const decks = await loadFlashcardDecks(currentUser);
  const contributors = new Set(decks.map((deck) => deck.authorName)).size;

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Preparation"
          title="Team flashcards"
          description="Create cards by hand or import a CSV, share a deck with the team, and vote on the most useful study sets."
        />
        <section className="grid gap-3 sm:grid-cols-3">
          <StatTile href="#shared-decks" label="Shared decks" value={decks.length} detail="Visible to signed-in members" />
          <StatTile href="#shared-decks" label="Flashcards" value={decks.reduce((sum, deck) => sum + deck.cardCount, 0)} detail="Across all published decks" />
          <StatTile href="#shared-decks" label="Contributors" value={contributors} detail="Deck authors" />
        </section>
        <div id="shared-decks">
          <FlashcardHub initialDecks={decks} eventNames={sciolyEvents.map((event) => event.name)} />
        </div>
      </div>
    </AppShell>
  );
}
