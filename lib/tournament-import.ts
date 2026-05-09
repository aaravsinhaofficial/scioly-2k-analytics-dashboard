import { mockEvents, schoolName } from "@/lib/seed";
import { calculateEventPoints, calculateMedalPoints, calculatePlacementScore } from "@/lib/rating";
import { resolveSchoolsWithSos } from "@/lib/scioly-elo";
import type { EventCategory, TournamentImportPerformance, TournamentImportPreview, TournamentSourceType } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

export interface TournamentParseOptions {
  mode?: TournamentSourceType;
  tournamentName?: string;
  date?: string;
  medalCutoff?: number;
  participationPoints?: number;
}

interface CsvRow {
  values: Record<string, string>;
  index: number;
}

interface ParsedTournamentSeed {
  tournamentName: string;
  date: string;
  attendingSchools: string[];
  performances: Array<Omit<TournamentImportPerformance, "medalPoints" | "eventPoints">>;
  warnings: string[];
  missingFields: string[];
}

const eventCategoryByName = new Map(mockEvents.map((event) => [normalizeName(event.name), event.category]));
const buildKeywords = ["tower", "robot", "wind", "build", "device", "vehicle", "bridge", "flight", "scrambler", "balsa"];

const columnAliases = {
  event: ["event", "eventname", "eventtitle", "competition"],
  rank: ["rank", "place", "placing", "placement", "medalplace", "overallplace"],
  school: ["school", "schoolname", "teamname", "institution", "organization"],
  participants: ["students", "student", "studentnames", "competitors", "participants", "names", "members", "partners", "eventpartners", "roster", "people"],
  team: ["team", "teamdesignation", "squad", "divisionteam", "schoolteam"],
  medal: ["medal", "medaled", "award", "awards", "awarded", "isaward", "isawarded"],
  medalCutoff: ["medalcutoff", "medals", "awardplaces", "medalplaces"],
  tournament: ["tournament", "tournamentname", "competitionname"],
  date: ["date", "tournamentdate"]
};

function categoryForEvent(eventName: string): EventCategory {
  const normalized = normalizeName(eventName);
  const exact = eventCategoryByName.get(normalized);
  if (exact) return exact;
  return buildKeywords.some((keyword) => normalized.includes(keyword)) ? "build" : "study";
}

function sanitizeHeader(value: string) {
  return normalizeName(value).replace(/\s+/g, "");
}

function parseCsv(rawInput: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < rawInput.length; index++) {
    const char = rawInput[index];
    const next = rawInput[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function rowsFromCsv(rawInput: string): CsvRow[] {
  const rows = parseCsv(rawInput);
  if (rows.length < 2) return [];

  const headers = rows[0].map(sanitizeHeader);
  return rows.slice(1).map((values, index) => {
    const mapped: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      mapped[header] = values[headerIndex] ?? "";
    });
    return { values: mapped, index: index + 2 };
  });
}

function pick(values: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const key = sanitizeHeader(alias);
    if (values[key]) return values[key].trim();
  }
  return "";
}

function parseRank(value: string) {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : NaN;
}

function normalizeDate(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const [, month, day, year] = slash;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function truthyMedal(value: string) {
  if (!value) return undefined;
  const normalized = normalizeName(value);
  if (["yes", "y", "true", "1", "medal", "medaled", "award", "awarded"].includes(normalized)) return true;
  if (["no", "n", "false", "0", "none", ""].includes(normalized)) return false;
  return undefined;
}

function splitStudentNames(value: string) {
  return value
    .replace(/\s+\+\s+/g, ";")
    .replace(/\s+&\s+/g, ";")
    .replace(/\s+and\s+/gi, ";")
    .split(/[;|/]/)
    .flatMap((part) => part.split(/\s*,\s*/))
    .map((name) => name.trim().replace(/^"+|"+$/g, ""))
    .filter((name) => name.length > 1 && !/^(none|n\/a|na)$/i.test(name));
}

function inferTeamDesignation(rowTeam: string, school: string) {
  const explicit = rowTeam.match(/\b([A-Z])\b/i)?.[1];
  if (explicit) return explicit.toUpperCase();

  const fromSchool = school.match(/\b([ABC])\s*(team)?$/i)?.[1];
  return (fromSchool ?? "A").toUpperCase();
}

function firstMetadataValue(rows: CsvRow[], aliases: string[]) {
  for (const row of rows) {
    const value = pick(row.values, aliases);
    if (value) return value;
  }
  return "";
}

function parseDuosmiumCsv(rawInput: string, options: TournamentParseOptions): ParsedTournamentSeed {
  const rows = rowsFromCsv(rawInput);
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const medalCutoff = Math.max(0, Math.round(options.medalCutoff ?? 6));
  const participationPoints = Math.max(0, Math.round(options.participationPoints ?? 10));

  if (rows.length === 0) {
    return {
      tournamentName: options.tournamentName?.trim() || "Imported Tournament",
      date: normalizeDate(options.date) || new Date().toISOString().slice(0, 10),
      attendingSchools: [schoolName],
      performances: [],
      warnings: ["CSV rows were not detected. Upload a Duosmium leaderboard CSV with headers."],
      missingFields: ["No placements were extracted."]
    };
  }

  const attendingSchools = new Set<string>();
  const performances: ParsedTournamentSeed["performances"] = [];
  let sawMedalColumn = false;

  for (const row of rows) {
    const eventName = pick(row.values, columnAliases.event);
    const rank = parseRank(pick(row.values, columnAliases.rank));
    const school = pick(row.values, columnAliases.school) || schoolName;
    const participantField = pick(row.values, columnAliases.participants);
    const studentNames = splitStudentNames(participantField);
    const medalColumn = pick(row.values, columnAliases.medal);
    const rowMedalCutoff = Number(pick(row.values, columnAliases.medalCutoff)) || medalCutoff;
    const medalFromColumn = truthyMedal(medalColumn);
    const teamDesignation = inferTeamDesignation(pick(row.values, columnAliases.team), school);

    if (school) attendingSchools.add(school.replace(/\s+[ABC]$/i, "").trim());
    if (medalColumn) sawMedalColumn = true;

    if (!eventName || !Number.isFinite(rank)) continue;
    if (studentNames.length === 0) {
      warnings.push(`Row ${row.index} (${eventName}) has no participant names, so no student will receive points for it.`);
      continue;
    }

    performances.push({
      studentName: studentNames.join(", "),
      studentNames,
      eventName,
      category: categoryForEvent(eventName),
      rank,
      schoolName: school,
      isMedal: medalFromColumn ?? rank <= rowMedalCutoff,
      medalCutoff: rowMedalCutoff,
      participationPoints,
      teamDesignation
    });
  }

  if (!sawMedalColumn) {
    warnings.push(`No medal/award column was found, so medals are inferred as rank <= ${medalCutoff}.`);
  }

  const tournamentName =
    options.tournamentName?.trim() ||
    firstMetadataValue(rows, columnAliases.tournament) ||
    "Duosmium Tournament";
  const date = normalizeDate(options.date) || normalizeDate(firstMetadataValue(rows, columnAliases.date)) || new Date().toISOString().slice(0, 10);

  if (performances.length === 0) missingFields.push("No placements were extracted.");

  return {
    tournamentName,
    date,
    attendingSchools: Array.from(attendingSchools),
    performances,
    warnings,
    missingFields
  };
}

function parseManualDump(rawInput: string, options: TournamentParseOptions): ParsedTournamentSeed {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const dateMatch = rawInput.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const schoolLine = lines.find((line) => /^schools?:/i.test(line));
  const attendingSchools = schoolLine
    ? schoolLine
        .replace(/^schools?:/i, "")
        .split(/[;,]/)
        .map((school) => school.trim())
        .filter(Boolean)
    : [schoolName];
  const medalCutoff = Math.max(0, Math.round(options.medalCutoff ?? 6));
  const participationPoints = Math.max(0, Math.round(options.participationPoints ?? 10));
  const tournamentName =
    options.tournamentName?.trim() ||
    lines.find((line) => !/^schools?:/i.test(line) && !/\b20\d{2}-\d{2}-\d{2}\b/.test(line) && !line.includes(":")) ||
    "Manual Tournament";
  const date = normalizeDate(options.date) || dateMatch?.[1] || new Date().toISOString().slice(0, 10);
  const performances: ParsedTournamentSeed["performances"] = [];

  for (const line of lines) {
    const match = line.match(/^(.+?):\s+(.+?)\s+([ABC])?\s*#?(\d{1,2})$/i);
    if (!match) continue;
    const [, eventName, studentField, teamDesignation = "A", rankValue] = match;
    const studentNames = splitStudentNames(studentField);
    const rank = Number(rankValue);
    if (studentNames.length === 0) continue;
    performances.push({
      studentName: studentNames.join(", "),
      studentNames,
      eventName: eventName.trim(),
      category: categoryForEvent(eventName),
      rank,
      schoolName,
      isMedal: rank <= medalCutoff,
      medalCutoff,
      participationPoints,
      teamDesignation: teamDesignation.toUpperCase()
    });
  }

  if (performances.length === 0) {
    missingFields.push("No placements were extracted.");
    warnings.push("Manual dumps use lines like `Water Quality: Jack Lee; Mrinal Rao A #2`.");
  }

  return {
    tournamentName,
    date,
    attendingSchools,
    performances,
    warnings,
    missingFields
  };
}

export async function parseTournamentInput(
  rawInput: string,
  options: TournamentParseOptions = {}
): Promise<TournamentImportPreview> {
  const mode = options.mode === "manual" ? "manual" : "duosmium_csv";
  const parsed = mode === "manual" ? parseManualDump(rawInput, options) : parseDuosmiumCsv(rawInput, options);
  const warnings = [...parsed.warnings];
  const schoolNames = parsed.attendingSchools.length > 0 ? parsed.attendingSchools : [schoolName];
  if (parsed.attendingSchools.length === 0) {
    warnings.push(`No schools found; defaulted to ${schoolName} for SOS.`);
  }

  const sos = await resolveSchoolsWithSos(schoolNames);
  const performances = parsed.performances.map((performance) => {
    const placementScore = calculatePlacementScore(
      performance.rank,
      sos.sosMultiplier,
      sos.benchmarkComparison.relativeDifficultyMultiplier
    );
    const medalPoints = performance.isMedal ? calculateMedalPoints(performance.rank, performance.medalCutoff) : 0;
    const eventPoints = calculateEventPoints({
      placementScore,
      rank: performance.rank,
      medalCutoff: performance.isMedal ? performance.medalCutoff : 0,
      participationPoints: performance.participationPoints
    });

    return {
      ...performance,
      medalPoints,
      eventPoints
    };
  });

  return {
    tournamentName: parsed.tournamentName,
    date: parsed.date,
    sourceType: mode,
    attendingSchools: sos.attendingSchools,
    sosMultiplier: sos.sosMultiplier,
    avgSciolyElo: sos.avgSciolyElo,
    benchmarkComparison: sos.benchmarkComparison,
    medalCutoff: Math.max(0, Math.round(options.medalCutoff ?? 6)),
    participationPoints: Math.max(0, Math.round(options.participationPoints ?? 10)),
    performances,
    warnings,
    missingFields: parsed.missingFields
  };
}

export function placementScoresForPreview(preview: TournamentImportPreview) {
  return preview.performances.map((performance) => ({
    ...performance,
    placementScore: calculatePlacementScore(
      performance.rank,
      preview.sosMultiplier,
      preview.benchmarkComparison.relativeDifficultyMultiplier
    )
  }));
}
