import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlashcardStudy } from "@/components/flashcards/FlashcardStudy";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/data";
import { loadFlashcardDeck } from "@/lib/flashcard-data";

export const metadata: Metadata = { title: "Study Flashcards" };
export const dynamic = "force-dynamic";

export default async function FlashcardDeckPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const { id } = await params;
  const deck = await loadFlashcardDeck(id, currentUser);
  if (!deck) notFound();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <PageHeader
          label="Team flashcards"
          title="Study deck"
          description="Flip through the cards, then vote based on accuracy and usefulness."
          actions={<Link href="/flashcards" className="inline-flex min-h-11 items-center justify-center rounded-md border border-court-line px-4 text-sm font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white">← All decks</Link>}
        />
        <FlashcardStudy deck={deck} />
      </div>
    </AppShell>
  );
}
