export type ReadinessConfidence = "low" | "medium" | "high";
export type ReadinessStatus = "Needs data" | "Developing" | "On track" | "Ready";

export interface ReadinessBreakdown {
  readinessScore: number;
  competitionScore: number;
  testoffScore: number;
  preparationScore: number;
  readinessIsProvisional: boolean;
  readinessConfidence: ReadinessConfidence;
  readinessStatus: ReadinessStatus;
  resultCount: number;
}

interface ReadinessPerformance {
  eventId: number;
  rank: number;
  date: string;
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number) {
  return Math.round(value);
}

function placementResultScore(rank: number) {
  return clamp(105 - Math.max(1, rank) * 5);
}

function statusFor(score: number, resultCount: number): ReadinessStatus {
  if (resultCount === 0) return "Needs data";
  if (score >= 80) return "Ready";
  if (score >= 65) return "On track";
  return "Developing";
}

export function calculateReadiness(input: {
  performances: ReadinessPerformance[];
  thirtyDayPoints: number;
  testoffScores: Array<{ score: number; weight: number }>;
}): ReadinessBreakdown {
  const resultsByEvent = new Map<number, ReadinessPerformance[]>();
  for (const performance of input.performances) {
    const rows = resultsByEvent.get(performance.eventId) ?? [];
    rows.push(performance);
    resultsByEvent.set(performance.eventId, rows);
  }
  const eventScores = Array.from(resultsByEvent.values()).map((rows) => {
    const recent = [...rows]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 3);
    return recent.reduce((sum, result) => sum + placementResultScore(result.rank), 0) / recent.length;
  });
  const competitionScore = eventScores.length > 0
    ? round(eventScores.reduce((sum, score) => sum + score, 0) / eventScores.length)
    : 0;
  const testoffWeight = input.testoffScores.reduce((sum, result) => sum + result.weight, 0);
  const testoffScore = testoffWeight > 0
    ? round(input.testoffScores.reduce((sum, result) => sum + result.score * result.weight, 0) / testoffWeight)
    : 0;
  const preparationScore = round(clamp(input.thirtyDayPoints / 6));
  const hasCompetition = eventScores.length > 0;
  const hasTestoffs = testoffWeight > 0;
  const evidenceWeight = (hasCompetition ? 60 : 0) + (hasTestoffs ? 30 : 0);
  const readinessScore = evidenceWeight === 0
    ? 0
    : round(((hasCompetition ? competitionScore * 60 : 0) + (hasTestoffs ? testoffScore * 30 : 0) + preparationScore * 10) / (evidenceWeight + 10));
  const resultCount = input.performances.length;
  const readinessConfidence: ReadinessConfidence = hasCompetition && hasTestoffs && resultCount >= 3 ? "high" : hasCompetition || hasTestoffs ? "medium" : "low";

  return {
    readinessScore,
    competitionScore,
    testoffScore,
    preparationScore,
    readinessIsProvisional: !hasCompetition || !hasTestoffs,
    readinessConfidence,
    readinessStatus: statusFor(readinessScore, resultCount + input.testoffScores.length),
    resultCount
  };
}

export function calculateEventReadiness(performances: ReadinessPerformance[]) {
  if (performances.length === 0) return 0;
  const recent = [...performances]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 4);
  const results = recent.reduce((sum, result) => sum + placementResultScore(result.rank), 0) / recent.length;
  const experience = clamp(recent.length * 25);
  return round(results * 0.8 + experience * 0.2);
}

export function readinessExplanation() {
  return "Readiness uses recent placements (60%), active-season testoffs (30%), and approved preparation from the last 30 days (10%). Missing competition or testoff evidence is left out, and the score is marked provisional.";
}
