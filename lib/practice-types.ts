export type PracticeQuestionType = "mcq" | "frq";
export type FrqSelfReview = "correct" | "partial" | "incorrect";
export type PracticeAttemptStatus = "in_progress" | "submitted" | "discarded";

export interface PracticeTestQuestion {
  id: number;
  testId: number;
  type: PracticeQuestionType;
  prompt: string;
  options: string[];
  correctOption?: number;
  modelAnswer?: string;
  explanation?: string;
  points: number;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeAttemptQuestion {
  id: number;
  type: PracticeQuestionType;
  prompt: string;
  options: string[];
  points: number;
  position: number;
  correctOption?: number;
  modelAnswer?: string;
  explanation?: string;
  isCorrect?: boolean;
}

export type PracticeAnswerValue = number | string;

export interface PracticeAttemptView {
  id: string;
  testId: number;
  testTitle: string;
  eventName: string;
  status: PracticeAttemptStatus;
  questions: PracticeAttemptQuestion[];
  answers: Record<string, PracticeAnswerValue>;
  frqReviews: Record<string, FrqSelfReview>;
  mcqCorrect: number;
  mcqTotal: number;
  earnedPoints: number;
  maxPoints: number;
  startedAt: string;
  updatedAt: string;
  submittedAt?: string;
  discardedAt?: string;
  version: number;
}

export interface PracticeAttemptSummary {
  id: string;
  status: PracticeAttemptStatus;
  mcqCorrect: number;
  mcqTotal: number;
  earnedPoints: number;
  maxPoints: number;
  startedAt: string;
  submittedAt?: string;
  discardedAt?: string;
  version: number;
}

export interface PracticeQuestionMutationResponse {
  ok: boolean;
  question?: PracticeTestQuestion;
  message?: string;
  error?: string;
  persisted?: boolean;
}

export interface PracticeQuestionCsvError {
  row: number;
  field?: string;
  message: string;
}

export interface PracticeQuestionCsvRow {
  sourceRow: number;
  type: PracticeQuestionType;
  prompt: string;
  options: string[];
  correctOption?: number;
  modelAnswer?: string;
  explanation?: string;
  points: number;
  position?: number;
}

export interface PracticeQuestionCsvPreviewRow extends Omit<PracticeQuestionCsvRow, "position"> {
  position: number;
}

export interface PracticeQuestionCsvPreview {
  rows: PracticeQuestionCsvPreviewRow[];
  errors: PracticeQuestionCsvError[];
  rowCount: number;
  canImport: boolean;
  maxRows: number;
}

export interface PracticeQuestionCsvImportResponse {
  ok: boolean;
  preview?: PracticeQuestionCsvPreview;
  /** Frozen CSV returned after resolving a public Google Sheets link. */
  resolvedCsv?: string;
  /** Binds a commit to the exact CSV and resolved preview the officer reviewed. */
  previewFingerprint?: string;
  questions?: PracticeTestQuestion[];
  message?: string;
  error?: string;
  persisted?: boolean;
}

export interface PracticeAttemptResponse {
  ok: boolean;
  attempt?: PracticeAttemptView;
  history?: PracticeAttemptSummary[];
  error?: string;
  message?: string;
}
