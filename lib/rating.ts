import type { BenchmarkComparison, DeltaValue, EventCategory, Performance, RatingTier, SchoolElo } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

export const ratingTiers: RatingTier[] = [
  {
    name: "Galaxy Opal",
    min: 95,
    max: 99,
    color: "#06B6D4",
    className: "text-tier-opal border-tier-opal bg-cyan-400/10",
    glow: true
  },
  {
    name: "Pink Diamond",
    min: 90,
    max: 94.99,
    color: "#EC4899",
    className: "text-tier-pinkDiamond border-tier-pinkDiamond bg-pink-500/10",
    glow: false
  },
  {
    name: "Diamond",
    min: 85,
    max: 89.99,
    color: "#3B82F6",
    className: "text-tier-diamond border-tier-diamond bg-blue-500/10",
    glow: false
  },
  {
    name: "Amethyst",
    min: 80,
    max: 84.99,
    color: "#A855F7",
    className: "text-tier-amethyst border-tier-amethyst bg-purple-500/10",
    glow: false
  },
  {
    name: "Ruby",
    min: 75,
    max: 79.99,
    color: "#EF4444",
    className: "text-tier-ruby border-tier-ruby bg-red-500/10",
    glow: false
  },
  {
    name: "Bronze",
    min: 60,
    max: 74.99,
    color: "#9CA3AF",
    className: "text-tier-bronze border-tier-bronze bg-zinc-400/10",
    glow: false
  }
];

export function roundRating(value: number) {
  return Math.round(value * 10) / 10;
}

export function clampOvr(value: number) {
  return roundRating(Math.max(60, Math.min(99, value)));
}

export function getRatingTier(value: number) {
  return ratingTiers.find((tier) => value >= tier.min && value <= tier.max) ?? ratingTiers.at(-1)!;
}

export function calculateSos(eloRatings: number[]) {
  if (eloRatings.length === 0) return 1;
  const sum = eloRatings.reduce((total, elo) => total + elo, 0);
  return roundRating(sum / (eloRatings.length * 1000));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const benchmarkSchools: Array<{
  schoolName: string;
  elo: number;
  tier: BenchmarkComparison["benchmarkTier"];
}> = [
  { schoolName: "Solon High School", elo: 2250, tier: "national" },
  { schoolName: "Mason High School", elo: 2185, tier: "national" },
  { schoolName: "Troy High School", elo: 2140, tier: "national" },
  { schoolName: "Seven Lakes High School", elo: 2100, tier: "national" },
  { schoolName: "LASA High School", elo: 1940, tier: "state" },
  { schoolName: "Clements High School", elo: 1860, tier: "state" },
  { schoolName: "Obra D Tompkins High School", elo: 1785, tier: "state" },
  { schoolName: "Cinco Ranch High School", elo: 1725, tier: "state" },
  { schoolName: "Cy Falls High School", elo: 1510, tier: "regional" },
  { schoolName: "Baseline School", elo: 1000, tier: "local" }
];

export function resolveBenchmarkComparison(
  attendingSchools: SchoolElo[],
  avgSciolyElo?: number,
  sosMultiplier = 1
): BenchmarkComparison {
  const avgElo =
    avgSciolyElo ??
    (attendingSchools.length > 0
      ? attendingSchools.reduce((total, school) => total + school.elo, 0) / attendingSchools.length
      : 1000);
  const strongest = [...attendingSchools].sort((a, b) => b.elo - a.elo)[0];
  const normalizedAttendees = new Map(attendingSchools.map((school) => [normalizeName(school.schoolName), school]));
  const directBenchmark = benchmarkSchools.find((school) => normalizedAttendees.has(normalizeName(school.schoolName)));
  const benchmark =
    directBenchmark ??
    benchmarkSchools.reduce((closest, candidate) =>
      Math.abs(candidate.elo - avgElo) < Math.abs(closest.elo - avgElo) ? candidate : closest
    );

  const benchmarkElo = directBenchmark ? normalizedAttendees.get(normalizeName(directBenchmark.schoolName))?.elo ?? directBenchmark.elo : benchmark.elo;
  const fieldFactor = avgElo / benchmarkElo;
  const strongestFactor = (strongest?.elo ?? avgElo) / benchmarkElo;
  const sosFactor = 0.9 + Math.min(0.45, Math.max(0, sosMultiplier - 1) * 0.25);
  const relativeDifficultyMultiplier = roundRating(clamp(fieldFactor * 0.72 + strongestFactor * 0.18 + sosFactor * 0.1, 0.72, 1.32));

  return {
    benchmarkSchool: benchmark.schoolName,
    benchmarkElo,
    benchmarkTier: benchmark.tier,
    source: directBenchmark ? "direct" : "equivalent",
    relativeDifficultyMultiplier,
    strongestAttendingSchool: strongest?.schoolName,
    strongestAttendingElo: strongest?.elo,
    explanation: directBenchmark
      ? `Direct benchmark found in the field: ${benchmark.schoolName}.`
      : `No listed national benchmark was in the field, so the closest Elo-equivalent benchmark is ${benchmark.schoolName}.`
  };
}

export function calculatePlacementScore(rank: number, sosMultiplier: number, relativeDifficultyMultiplier = 1) {
  return Math.max(0, roundRating((100 - rank) * sosMultiplier * relativeDifficultyMultiplier));
}

export function calculateMedalPoints(rank: number, medalCutoff: number) {
  if (medalCutoff <= 0 || rank > medalCutoff) return 0;
  const placeBonus = Math.max(0, medalCutoff - rank + 1);
  return 12 + placeBonus * 3;
}

export function calculateEventPoints(input: {
  placementScore: number;
  rank: number;
  medalCutoff: number;
  participationPoints: number;
}) {
  return Math.round(input.participationPoints + input.placementScore * 0.18 + calculateMedalPoints(input.rank, input.medalCutoff));
}

export function calculateCategoryRating(performances: Performance[], category: EventCategory) {
  const matching = performances.filter((performance) => performance.eventCategory === category);
  if (matching.length === 0) return undefined;
  const averageScore =
    matching.reduce((total, performance) => total + performance.placementScore, 0) / matching.length;
  const consistencyBonus = Math.min(4, matching.length * 0.45);
  return clampOvr(55 + averageScore / 4 + consistencyBonus);
}

export function calculateOverallRating(input: {
  studyRating?: number;
  buildRating?: number;
  totalPoints: number;
}) {
  const { studyRating, buildRating, totalPoints } = input;
  const hasStudy = typeof studyRating === "number";
  const hasBuild = typeof buildRating === "number";

  if (hasStudy && hasBuild) {
    return clampOvr(studyRating * 0.4 + buildRating * 0.4 + totalPoints * 0.002);
  }

  if (hasStudy) {
    return clampOvr(studyRating * 0.8 + totalPoints * 0.002);
  }

  if (hasBuild) {
    return clampOvr(buildRating * 0.8 + totalPoints * 0.002);
  }

  return clampOvr(60 + totalPoints * 0.01);
}

export function calculateAveragePlacement(performances: Pick<Performance, "rank">[]) {
  if (performances.length === 0) return undefined;
  return roundRating(performances.reduce((total, performance) => total + performance.rank, 0) / performances.length);
}

export function calculatePotentialRating(input: {
  ovrRating: number;
  studyRating?: number;
  buildRating?: number;
  thirtyDayPoints: number;
  medalCount: number;
  avgPlacement?: number;
}) {
  const categoryCeiling = Math.max(input.studyRating ?? 60, input.buildRating ?? 60);
  const activityLift = Math.min(5, input.thirtyDayPoints / 120);
  const medalLift = Math.min(4, input.medalCount * 0.8);
  const placementLift = typeof input.avgPlacement === "number" ? Math.max(0, (10 - input.avgPlacement) * 0.55) : 0;
  return clampOvr(Math.max(input.ovrRating, categoryCeiling) + activityLift + medalLift + placementLift);
}

export function deltaValue(current: number, previous?: number, lowerIsBetter = false): DeltaValue {
  if (typeof previous !== "number") {
    return {
      value: 0,
      direction: "flat",
      isGood: true
    };
  }

  const value = roundRating(current - previous);
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const isGood = lowerIsBetter ? value <= 0 : value >= 0;

  return {
    value,
    direction,
    isGood
  };
}
