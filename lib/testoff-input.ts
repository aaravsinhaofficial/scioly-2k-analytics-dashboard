export interface TestoffScoreInput {
  studentId: string;
  rawScore: number;
  notes?: string;
}

export interface ValidTestoffInput {
  name: string;
  date: string;
  eventId?: number;
  eventName?: string;
  eventCategory: "study" | "build";
  seasonId?: number;
  seasonName?: string;
  maxScore: number;
  weight: number;
  notes?: string;
  results: TestoffScoreInput[];
}

export function shouldActivateTestoffSeason(startDate: string, activeStartDate?: string) {
  // Importing historical scores must not replace the current season.
  return !activeStartDate || startDate >= activeStartDate;
}

// Match the database's numeric(..., 3) storage before comparing or ranking.
export function roundTestoffScore(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function rankTestoffResults(results: TestoffScoreInput[]) {
  const sorted = results.map((result) => ({ ...result, rawScore: roundTestoffScore(result.rawScore) }))
    .sort((left, right) => right.rawScore - left.rawScore || left.studentId.localeCompare(right.studentId));
  let rank = 0;
  let previousScore: number | undefined;
  return sorted.map((result, index) => {
    if (previousScore === undefined || result.rawScore !== previousScore) rank = index + 1;
    previousScore = result.rawScore;
    return { ...result, rank };
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function positiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function validateTestoffInput(input: unknown): { data: ValidTestoffInput; error?: never } | { error: string; data?: never } {
  const body = record(input);
  if (!body) return { error: "The request body must be a JSON object." };
  for (const field of ["name", "date", "eventName", "seasonName", "notes"] as const) {
    if (body[field] !== undefined && typeof body[field] !== "string") return { error: `${field} must be text.` };
  }
  const name = (body.name as string | undefined)?.trim();
  const date = (body.date as string | undefined)?.trim();
  if (!name || name.length > 120) return { error: "Enter a session name up to 120 characters." };
  const parsedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return { error: "Enter a valid session date." };
  }
  if (body.eventId !== undefined && !positiveId(body.eventId)) return { error: "Choose a valid event." };
  if (body.seasonId !== undefined && !positiveId(body.seasonId)) return { error: "Choose a valid season." };
  const eventName = (body.eventName as string | undefined)?.trim();
  const seasonName = (body.seasonName as string | undefined)?.trim();
  if (!body.eventId && (!eventName || eventName.length > 120)) {
    return { error: "Choose an event or enter a new event name up to 120 characters." };
  }
  if (seasonName && seasonName.length > 80) return { error: "Season name must be 80 characters or fewer." };
  if (body.eventCategory !== undefined && body.eventCategory !== "study" && body.eventCategory !== "build") {
    return { error: "Event category must be study or build." };
  }
  const maxScore = typeof body.maxScore === "number" ? roundTestoffScore(body.maxScore) : NaN;
  const inputWeight = body.weight === undefined ? 1 : body.weight;
  const weight = typeof inputWeight === "number" ? roundTestoffScore(inputWeight) : NaN;
  if (!Number.isFinite(maxScore) || maxScore < 0.001 || maxScore > 9999999.999) {
    return { error: "Maximum score must be between 0.001 and 9,999,999.999." };
  }
  if (!Number.isFinite(weight) || weight < 0.001 || weight > 10) {
    return { error: "Weight must be between 0.001 and 10." };
  }
  if (!Array.isArray(body.results) || body.results.length === 0) return { error: "Enter at least one student score." };
  const results: TestoffScoreInput[] = [];
  for (const value of body.results) {
    const entry = record(value);
    if (!entry || typeof entry.studentId !== "string" || !entry.studentId.trim() ||
        typeof entry.rawScore !== "number" || !Number.isFinite(entry.rawScore) ||
        (entry.notes !== undefined && typeof entry.notes !== "string")) {
      return { error: "Every result must contain a student and a numeric score. Omit students without a score." };
    }
    const rawScore = roundTestoffScore(entry.rawScore);
    if (entry.rawScore < 0 || rawScore > maxScore) return { error: `Scores must be between 0 and ${maxScore}.` };
    results.push({ studentId: entry.studentId.trim(), rawScore, notes: (entry.notes as string | undefined)?.trim() || undefined });
  }
  if (new Set(results.map((result) => result.studentId)).size !== results.length) {
    return { error: "Each student can appear only once in a testoff session." };
  }
  return { data: {
    name, date: date!, eventId: body.eventId as number | undefined, eventName,
    eventCategory: body.eventCategory === "build" ? "build" : "study",
    seasonId: body.seasonId as number | undefined, seasonName, maxScore, weight,
    notes: (body.notes as string | undefined)?.trim() || undefined, results
  } };
}
