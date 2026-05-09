import { calculateEventPoints, calculateMedalPoints, calculatePlacementScore, calculateSos, resolveBenchmarkComparison } from "@/lib/rating";
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

function splitStudentNames(value: string) {
  return value
    .replace(/\s+\+\s+/g, ";")
    .replace(/\s+&\s+/g, ";")
    .replace(/\s+and\s+/gi, ";")
    .split(/[;|/]/)
    .flatMap((part) => part.split(/\s*,\s*/))
    .map((name) => name.trim().replace(/^"+|"+$/g, ""))
    .filter((name) => name.length > 1);
}

function parseCsv(rawInput: string) {
  const rows = rawInput
    .split(/\r?\n/)
    .map((line) => line.split(",").map((value) => value.trim()))
    .filter((row) => row.some(Boolean));
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => normalizeName(value).replace(/\s+/g, ""));
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

export function buildStaticTournamentPreview(
  rawInput: string,
  options: { mode?: "duosmium_csv" | "manual"; tournamentName?: string; date?: string; medalCutoff?: number; participationPoints?: number } = {}
): TournamentImportPreview {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings = ["Static GitHub Pages mode parses locally; committing imports requires the Vercel/Supabase backend."];
  const medalCutoff = Math.max(0, Math.round(options.medalCutoff ?? 6));
  const participationPoints = Math.max(0, Math.round(options.participationPoints ?? 10));
  const date = options.date || rawInput.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] || new Date().toISOString().slice(0, 10);
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
    options.tournamentName ||
    lines.find((line) => !/^schools?:/i.test(line) && !/\b20\d{2}-\d{2}-\d{2}\b/.test(line) && !line.includes(":")) ||
    "Imported Tournament";
  const performances: TournamentImportPerformance[] = [];
  const csvRows = parseCsv(rawInput);

  if (csvRows.length > 0 && options.mode !== "manual") {
    for (const row of csvRows) {
      const eventName = row.event || row.eventname || row.eventtitle;
      const rank = Number((row.rank || row.place || row.placement || "").match(/\d+/)?.[0]);
      const studentNames = splitStudentNames(row.students || row.student || row.participants || row.names || row.members || "");
      if (!eventName || !Number.isFinite(rank) || studentNames.length === 0) continue;
      const placementScore = calculatePlacementScore(rank, sosMultiplier, benchmarkComparison.relativeDifficultyMultiplier);
      const isMedal = /^(yes|true|1|medal|awarded)$/i.test(row.medal || row.award || "") || rank <= medalCutoff;
      const eventMedalCutoff = isMedal ? medalCutoff : 0;
      const medalPoints = isMedal ? calculateMedalPoints(rank, medalCutoff) : 0;
      performances.push({
        studentName: studentNames.join(", "),
        studentNames,
        eventName: eventName.trim(),
        category: resolveEventCategory(eventName),
        rank,
        schoolName: row.school || row.schoolname || staticSchoolName,
        isMedal,
        medalCutoff,
        participationPoints,
        medalPoints,
        eventPoints: calculateEventPoints({ placementScore, rank, medalCutoff: eventMedalCutoff, participationPoints }),
        teamDesignation: (row.team || row.teamdesignation || "A").slice(0, 1).toUpperCase()
      });
    }
  }

  for (const line of lines) {
    const match = line.match(/^(.+?):\s+(.+?)\s+([ABC])?\s*#?(\d{1,2})$/i);
    if (!match) continue;
    const [, eventName, studentField, teamDesignation = "A", rank] = match;
    const studentNames = splitStudentNames(studentField);
    const rankNumber = Number(rank);
    const placementScore = calculatePlacementScore(rankNumber, sosMultiplier, benchmarkComparison.relativeDifficultyMultiplier);
    const isMedal = rankNumber <= medalCutoff;
    const eventMedalCutoff = isMedal ? medalCutoff : 0;
    const medalPoints = isMedal ? calculateMedalPoints(rankNumber, medalCutoff) : 0;
    performances.push({
      studentName: studentNames.join(", "),
      studentNames,
      eventName: eventName.trim(),
      category: resolveEventCategory(eventName),
      rank: rankNumber,
      schoolName: staticSchoolName,
      isMedal,
      medalCutoff,
      participationPoints,
      medalPoints,
      eventPoints: calculateEventPoints({ placementScore, rank: rankNumber, medalCutoff: eventMedalCutoff, participationPoints }),
      teamDesignation: teamDesignation.toUpperCase()
    });
  }

  const missingFields: string[] = [];
  if (performances.length === 0) missingFields.push("No placements were extracted.");

  return {
    tournamentName,
    date,
    sourceType: options.mode ?? "duosmium_csv",
    attendingSchools,
    sosMultiplier,
    avgSciolyElo,
    benchmarkComparison,
    medalCutoff,
    participationPoints,
    performances,
    warnings,
    missingFields
  };
}
