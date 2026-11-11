import type { FrqSelfReview, PracticeAnswerValue, PracticeAttemptQuestion } from "./practice-types";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function isCorrectMcqAnswer(question: PracticeAttemptQuestion, answer: PracticeAnswerValue | undefined) {
  return question.type === "mcq"
    && typeof answer === "number"
    && Number.isInteger(answer)
    && answer >= 0
    && answer < question.options.length
    && answer === question.correctOption;
}

export function normalizeAnswers(value: unknown, questions: PracticeAttemptQuestion[]) {
  const supplied = object(value);
  const answers: Record<string, PracticeAnswerValue> = {};
  for (const question of questions) {
    const answer = supplied[String(question.id)];
    if (question.type === "mcq") {
      const selected = answer;
      if (typeof selected === "number" && Number.isInteger(selected) && selected >= 0 && selected < question.options.length) answers[String(question.id)] = selected;
    } else if (typeof answer === "string") {
      answers[String(question.id)] = answer.slice(0, 20000);
    }
  }
  return answers;
}

export function normalizeReviews(value: unknown, questions: PracticeAttemptQuestion[]) {
  const supplied = object(value);
  const frqIds = new Set(questions.filter((question) => question.type === "frq").map((question) => String(question.id)));
  const reviews: Record<string, FrqSelfReview> = {};
  for (const [id, review] of Object.entries(supplied)) {
    if (frqIds.has(id) && (review === "correct" || review === "partial" || review === "incorrect")) reviews[id] = review;
  }
  return reviews;
}

export function score(questions: PracticeAttemptQuestion[], answers: Record<string, PracticeAnswerValue>, reviews: Record<string, FrqSelfReview>) {
  let mcqCorrect = 0;
  let mcqTotal = 0;
  let earnedPoints = 0;
  let maxPoints = 0;
  for (const question of questions) {
    maxPoints += question.points;
    if (question.type === "mcq") {
      mcqTotal += 1;
      if (isCorrectMcqAnswer(question, answers[String(question.id)])) {
        mcqCorrect += 1;
        earnedPoints += question.points;
      }
    } else {
      const review = reviews[String(question.id)];
      if (review === "correct") earnedPoints += question.points;
      else if (review === "partial") earnedPoints += question.points / 2;
    }
  }
  return { mcqCorrect, mcqTotal, earnedPoints: Math.round(earnedPoints * 100) / 100, maxPoints };
}

