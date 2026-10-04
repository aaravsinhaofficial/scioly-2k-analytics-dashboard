export interface FlashcardCard {
  id?: number;
  front: string;
  back: string;
  position: number;
}

export interface FlashcardDeckSummary {
  id: string;
  title: string;
  description: string;
  eventName: string;
  authorName: string;
  cardCount: number;
  score: number;
  upvotes: number;
  downvotes: number;
  userVote: -1 | 0 | 1;
  isOwner: boolean;
  canModerate: boolean;
  createdAt: string;
}

export interface FlashcardDeck extends FlashcardDeckSummary {
  cards: FlashcardCard[];
}

export interface FlashcardMutationResponse {
  ok: boolean;
  deck?: FlashcardDeckSummary;
  error?: string;
  message?: string;
  persisted?: boolean;
}
