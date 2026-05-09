import OpenAI from "openai";
import { mockEvents, schoolName } from "@/lib/seed";
import { calculatePlacementScore } from "@/lib/rating";
import { resolveSchoolsWithSos } from "@/lib/scioly-elo";
import type { EventCategory, TournamentImportPerformance, TournamentImportPreview } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

const eventCategoryByName = new Map(mockEvents.map((event) => [normalizeName(event.name), event.category]));

const buildKeywords = ["tower", "robot", "wind", "build", "device", "vehicle", "bridge", "flight", "scrambler"];

function categoryForEvent(eventName: string): EventCategory {
  const normalized = normalizeName(eventName);
  const exact = eventCategoryByName.get(normalized);
  if (exact) return exact;
  return buildKeywords.some((keyword) => normalized.includes(keyword)) ? "build" : "study";
}

function coercePreview(raw: {
  tournamentName?: string;
  date?: string;
  attendingSchools?: string[];
  performances?: Array<Partial<TournamentImportPerformance>>;
}) {
  return {
    tournamentName: raw.tournamentName?.trim() || "Imported Tournament",
    date: raw.date?.trim() || new Date().toISOString().slice(0, 10),
    attendingSchools: raw.attendingSchools?.map((school) => school.trim()).filter(Boolean) ?? [],
    performances:
      raw.performances
        ?.filter((performance) => performance.studentName && performance.eventName && performance.rank)
        .map((performance) => ({
          studentName: String(performance.studentName),
          eventName: String(performance.eventName),
          category: performance.category ?? categoryForEvent(String(performance.eventName)),
          rank: Number(performance.rank),
          teamDesignation: performance.teamDesignation || "A"
        })) ?? []
  };
}

async function parseWithOpenAI(rawInput: string) {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Extract Science Olympiad tournament results into compact JSON. Prefer ISO dates. Team designation is A/B/C when present, otherwise A. Category must be study or build."
      },
      {
        role: "user",
        content: rawInput
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "scioly_tournament_import",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            tournamentName: { type: "string" },
            date: { type: "string" },
            attendingSchools: { type: "array", items: { type: "string" } },
            performances: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  studentName: { type: "string" },
                  eventName: { type: "string" },
                  category: { type: "string", enum: ["study", "build"] },
                  rank: { type: "number" },
                  teamDesignation: { type: "string" }
                },
                required: ["studentName", "eventName", "category", "rank", "teamDesignation"]
              }
            }
          },
          required: ["tournamentName", "date", "attendingSchools", "performances"]
        }
      }
    } as never
  });

  const content = response.choices[0]?.message.content;
  if (!content) return null;
  return coercePreview(JSON.parse(content) as Parameters<typeof coercePreview>[0]);
}

function parseWithFallback(rawInput: string) {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dateMatch = rawInput.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const schoolLine = lines.find((line) => /^schools?:/i.test(line));
  const attendingSchools = schoolLine
    ? schoolLine
        .replace(/^schools?:/i, "")
        .split(/[;,]/)
        .map((school) => school.trim())
        .filter(Boolean)
    : [schoolName];

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
      category: categoryForEvent(eventName),
      rank: Number(rank),
      teamDesignation: teamDesignation.toUpperCase()
    });
  }

  return coercePreview({
    tournamentName,
    date: dateMatch?.[1],
    attendingSchools,
    performances
  });
}

export async function parseTournamentInput(rawInput: string): Promise<TournamentImportPreview> {
  const warnings: string[] = [];
  let parsed = null;

  try {
    parsed = await parseWithOpenAI(rawInput);
  } catch (error) {
    warnings.push("OpenAI extraction failed, so the deterministic local parser was used.");
  }

  if (!parsed) {
    parsed = parseWithFallback(rawInput);
    if (!process.env.OPENAI_API_KEY) {
      warnings.push("OPENAI_API_KEY is not set; using local parser.");
    }
  }

  if (parsed.attendingSchools.length === 0) {
    parsed.attendingSchools = [schoolName];
    warnings.push("No schools found; defaulted to Obra D Tompkins High School for SOS.");
  }

  const sos = await resolveSchoolsWithSos(parsed.attendingSchools);
  const missingFields: string[] = [];
  if (!parsed.tournamentName) missingFields.push("Tournament name is missing.");
  if (!parsed.date) missingFields.push("Tournament date is missing.");
  if (parsed.performances.length === 0) missingFields.push("No placements were extracted.");

  return {
    tournamentName: parsed.tournamentName,
    date: parsed.date,
    attendingSchools: sos.attendingSchools,
    sosMultiplier: sos.sosMultiplier,
    avgSciolyElo: sos.avgSciolyElo,
    benchmarkComparison: sos.benchmarkComparison,
    performances: parsed.performances.map((performance) => ({
      ...performance,
      category: performance.category ?? categoryForEvent(performance.eventName),
      rank: Number(performance.rank),
      teamDesignation: performance.teamDesignation || "A"
    })),
    warnings,
    missingFields
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
