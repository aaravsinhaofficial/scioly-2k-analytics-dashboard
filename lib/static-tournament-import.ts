import { calculateSos, resolveBenchmarkComparison } from "@/lib/rating";
import type { EventCategory, SchoolElo, TournamentImportPerformance, TournamentImportPreview } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

const staticSchoolName = "Obra D Tompkins High School";

const fallbackElos: Record<string, number> = {
  "Obra D Tompkins High School": 1785,
  "Seven Lakes High School": 2100,
  "Solon High School": 2250,
  "Mason High School": 2185,
  "Troy High School": 2140,
  "Clements High School": 1860,
  "Cinco Ranch High School": 1725,
  "Cy Falls High School": 1510,
  "LASA High School": 1940,
  "Westlake High School": 1810,
  "Dulles High School": 1435,
  "Cypress Ranch High School": 1490,
  "Pearland High School": 1375
};

const eventCategories: Record<string, EventCategory> = {
  "anatomy physiology": "study",
  "disease detectives": "study",
  "chemistry lab": "study",
  codebusters: "study",
  astronomy: "study",
  fossils: "study",
  tower: "build",
  "robot tour": "build",
  "wind power": "build",
  "experimental design": "build"
};

function resolveEventCategory(eventName: string): EventCategory {
  const normalized = normalizeName(eventName);
  if (eventCategories[normalized]) return eventCategories[normalized];
  return /tower|robot|wind|build|device|vehicle|bridge|flight|scrambler/.test(normalized) ? "build" : "study";
}

function resolveSchool(schoolName: string): SchoolElo {
  return {
    schoolName,
    elo: fallbackElos[schoolName] ?? 1000
  };
}

export function buildStaticTournamentPreview(rawInput: string): TournamentImportPreview {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings = ["Static GitHub Pages mode uses the local parser; OpenAI and Supabase require a server deployment."];
  const date = rawInput.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? new Date().toISOString().slice(0, 10);
  const schoolLine = lines.find((line) => /^schools?:/i.test(line));
  const schoolNames = schoolLine
    ? schoolLine
        .replace(/^schools?:/i, "")
        .split(/[;,]/)
        .map((school) => school.trim())
        .filter(Boolean)
    : [staticSchoolName];
  const attendingSchools = Array.from(new Set(schoolNames)).map(resolveSchool);
  const sosMultiplier = calculateSos(attendingSchools.map((school) => school.elo));
  const avgSciolyElo =
    attendingSchools.length === 0
      ? 1000
      : Math.round(attendingSchools.reduce((total, school) => total + school.elo, 0) / attendingSchools.length);
  const benchmarkComparison = resolveBenchmarkComparison(attendingSchools, avgSciolyElo, sosMultiplier);
  const tournamentName =
    lines.find((line) => !/^schools?:/i.test(line) && !/\b20\d{2}-\d{2}-\d{2}\b/.test(line) && !line.includes(":")) ??
    "Imported Tournament";
  const performances: TournamentImportPerformance[] = [];

  for (const line of lines) {
    const match = line.match(/^(.+?):\s+(.+?)\s+([ABC])?\s*#?(\d{1,2})$/i);
    if (!match) continue;
    const [, eventName, studentName, teamDesignation = "A", rank] = match;
    performances.push({
      studentName: studentName.trim(),
      eventName: eventName.trim(),
      category: resolveEventCategory(eventName),
      rank: Number(rank),
      teamDesignation: teamDesignation.toUpperCase()
    });
  }

  const missingFields: string[] = [];
  if (performances.length === 0) missingFields.push("No placements were extracted.");

  return {
    tournamentName,
    date,
    attendingSchools,
    sosMultiplier,
    avgSciolyElo,
    benchmarkComparison,
    performances,
    warnings,
    missingFields
  };
}
