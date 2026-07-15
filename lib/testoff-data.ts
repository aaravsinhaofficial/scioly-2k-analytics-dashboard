import "server-only";

import { sciolyEvents, type SciolyEventHub } from "@/lib/resource-data";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import { normalizeEventName } from "@/lib/utils";
import type {
  EventCategory,
  TestoffAdminData,
  TestoffCompositeRanking,
  TestoffDashboardData,
  TestoffEventOption,
  TestoffEventRanking,
  TestoffResult,
  TestoffSeason,
  TestoffSessionDetail,
  TestoffStudentOption
} from "@/lib/types";

type DbRow = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function eventCategory(value: unknown): EventCategory {
  return value === "build" ? "build" : "study";
}

function catalogEventCategory(value: SciolyEventHub["category"]): EventCategory {
  return value === "Build" ? "build" : "study";
}

function testoffEventOptions(rows: DbRow[]): TestoffEventOption[] {
  const databaseEvents = rows.map((row) => ({
    id: numberValue(row.id),
    name: stringValue(row.name, "Unknown event"),
    category: eventCategory(row.category)
  }));
  const databaseEventsByCanonicalName = new Map<string, typeof databaseEvents>();

  for (const event of databaseEvents) {
    const canonicalName = normalizeEventName(event.name);
    const matches = databaseEventsByCanonicalName.get(canonicalName) ?? [];
    matches.push(event);
    databaseEventsByCanonicalName.set(canonicalName, matches);
  }

  const currentCanonicalNames = new Set<string>();
  const currentEvents = sciolyEvents.map<TestoffEventOption>((catalogEvent) => {
    const canonicalName = normalizeEventName(catalogEvent.name);
    currentCanonicalNames.add(canonicalName);
    const matches = databaseEventsByCanonicalName.get(canonicalName) ?? [];
    const databaseEvent =
      matches.find((event) => event.name.toLowerCase() === catalogEvent.name.toLowerCase()) ?? matches[0];

    return {
      value: `catalog:${catalogEvent.slug}`,
      id: databaseEvent?.id,
      name: catalogEvent.name,
      category: databaseEvent?.category ?? catalogEventCategory(catalogEvent.category),
      isCurrentSeason: true,
      isTrial: catalogEvent.isTrial === true
    };
  });

  const retainedCanonicalNames = new Set(currentCanonicalNames);
  const legacyEvents = databaseEvents.flatMap<TestoffEventOption>((event) => {
    const canonicalName = normalizeEventName(event.name);
    if (retainedCanonicalNames.has(canonicalName)) return [];
    retainedCanonicalNames.add(canonicalName);
    return [{
      value: `database:${event.id}`,
      id: event.id,
      name: event.name,
      category: event.category,
      isCurrentSeason: false,
      isTrial: false
    }];
  });

  return [
    ...currentEvents,
    ...legacyEvents.sort((left, right) => left.name.localeCompare(right.name))
  ];
}

function round(value: number, places = 3) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function mapSeason(row: DbRow): TestoffSeason {
  return {
    id: numberValue(row.id),
    name: stringValue(row.name, "Unnamed season"),
    startDate: stringValue(row.start_date),
    endDate: stringValue(row.end_date),
    isActive: row.is_active === true
  };
}

function rankCompositeRows(
  entries: Array<Omit<TestoffCompositeRanking, "rank">>
): TestoffCompositeRanking[] {
  const sorted = [...entries].sort(
    (left, right) =>
      right.compositeScore - left.compositeScore ||
      right.completedSessions - left.completedSessions ||
      left.studentName.localeCompare(right.studentName)
  );

  let displayedRank = 0;
  let previousScore: number | undefined;

  return sorted.map((entry, index) => {
    if (previousScore === undefined || Math.abs(entry.compositeScore - previousScore) > 0.0005) {
      displayedRank = index + 1;
      previousScore = entry.compositeScore;
    }

    return { ...entry, rank: displayedRank };
  });
}

function emptyDashboard(): TestoffDashboardData {
  return {
    configured: false,
    seasons: [],
    eventRankings: []
  };
}

function emptyAdmin(): TestoffAdminData {
  return {
    configured: false,
    seasons: [],
    events: [],
    students: []
  };
}

function adminClient() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to load testoff data.");
  }
  return client;
}

export async function loadTestoffDashboardData(): Promise<TestoffDashboardData> {
  if (!hasSupabaseConfig()) return emptyDashboard();

  const supabase = adminClient();
  const [seasonResult, eventResult, sessionResult, resultResult, studentResult] = await Promise.all([
    supabase.from("seasons").select("id,name,start_date,end_date,is_active").order("start_date", { ascending: false }),
    supabase.from("events").select("id,name,category").order("name"),
    supabase
      .from("testoff_sessions")
      .select("id,season_id,event_id,name,date,max_score,weight,notes")
      .order("date", { ascending: false }),
    supabase
      .from("testoff_results")
      .select("id,session_id,student_id,raw_score,rank,ranking_score,notes"),
    supabase.from("students").select("id,name")
  ]);

  const namedResults = [
    ["seasons", seasonResult],
    ["events", eventResult],
    ["testoff sessions", sessionResult],
    ["testoff results", resultResult],
    ["students", studentResult]
  ] as const;

  for (const [name, result] of namedResults) {
    if (result.error) throw new Error(`Could not load ${name}: ${result.error.message}`);
  }

  const seasons = ((seasonResult.data ?? []) as DbRow[]).map(mapSeason);
  const events = ((eventResult.data ?? []) as DbRow[]).map((row) => ({
    id: numberValue(row.id),
    name: stringValue(row.name, "Unknown event"),
    category: eventCategory(row.category)
  }));
  const students = ((studentResult.data ?? []) as DbRow[]).map((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name, "Unknown student")
  }));

  const seasonById = new Map(seasons.map((season) => [season.id, season]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const studentById = new Map(students.map((student) => [student.id, student.name]));
  const resultsBySession = new Map<number, TestoffResult[]>();

  for (const row of (resultResult.data ?? []) as DbRow[]) {
    const sessionId = numberValue(row.session_id);
    const result: TestoffResult = {
      id: numberValue(row.id),
      sessionId,
      studentId: stringValue(row.student_id),
      studentName: studentById.get(stringValue(row.student_id)) ?? "Unknown student",
      rawScore: numberValue(row.raw_score),
      rank: numberValue(row.rank),
      rankingScore: numberValue(row.ranking_score),
      notes: stringValue(row.notes) || undefined
    };
    const entries = resultsBySession.get(sessionId) ?? [];
    entries.push(result);
    resultsBySession.set(sessionId, entries);
  }

  const sessions = ((sessionResult.data ?? []) as DbRow[]).map<TestoffSessionDetail>((row) => {
    const id = numberValue(row.id);
    return {
      id,
      seasonId: numberValue(row.season_id),
      eventId: numberValue(row.event_id),
      name: stringValue(row.name, "Unnamed testoff"),
      date: stringValue(row.date),
      maxScore: numberValue(row.max_score, 1),
      weight: numberValue(row.weight, 1),
      notes: stringValue(row.notes) || undefined,
      results: [...(resultsBySession.get(id) ?? [])].sort(
        (left, right) => left.rank - right.rank || right.rawScore - left.rawScore
      )
    };
  });

  const groupedSessions = new Map<string, TestoffSessionDetail[]>();
  for (const session of sessions) {
    const key = `${session.seasonId}:${session.eventId}`;
    const entries = groupedSessions.get(key) ?? [];
    entries.push(session);
    groupedSessions.set(key, entries);
  }

  const eventRankings: TestoffEventRanking[] = [];
  for (const groupSessions of groupedSessions.values()) {
    const first = groupSessions[0];
    const season = seasonById.get(first.seasonId);
    const event = eventById.get(first.eventId);
    const totalWeight = groupSessions.reduce((sum, session) => sum + session.weight, 0);
    const studentTotals = new Map<
      string,
      { studentName: string; weightedScore: number; completedSessions: number }
    >();

    for (const session of groupSessions) {
      for (const result of session.results) {
        const current = studentTotals.get(result.studentId) ?? {
          studentName: result.studentName,
          weightedScore: 0,
          completedSessions: 0
        };
        current.weightedScore += result.rankingScore;
        current.completedSessions += 1;
        studentTotals.set(result.studentId, current);
      }
    }

    const rankings = rankCompositeRows(
      Array.from(studentTotals.entries()).map(([studentId, total]) => ({
        studentId,
        studentName: total.studentName,
        compositeScore: totalWeight > 0 ? round(total.weightedScore / totalWeight) : 0,
        weightedScore: round(total.weightedScore),
        completedSessions: total.completedSessions,
        totalSessions: groupSessions.length
      }))
    );

    eventRankings.push({
      seasonId: first.seasonId,
      seasonName: season?.name ?? "Unknown season",
      eventId: first.eventId,
      eventName: event?.name ?? "Unknown event",
      eventCategory: event?.category ?? "study",
      totalWeight: round(totalWeight),
      sessions: [...groupSessions].sort((left, right) => right.date.localeCompare(left.date)),
      rankings
    });
  }

  eventRankings.sort(
    (left, right) =>
      Number(right.seasonId === seasons.find((season) => season.isActive)?.id) -
        Number(left.seasonId === seasons.find((season) => season.isActive)?.id) ||
      left.eventName.localeCompare(right.eventName)
  );

  return {
    configured: true,
    activeSeasonId: seasons.find((season) => season.isActive)?.id,
    seasons,
    eventRankings
  };
}

export async function loadTestoffAdminData(): Promise<TestoffAdminData> {
  if (!hasSupabaseConfig()) return emptyAdmin();

  const supabase = adminClient();
  const [seasonResult, eventResult, studentResult] = await Promise.all([
    supabase.from("seasons").select("id,name,start_date,end_date,is_active").order("start_date", { ascending: false }),
    supabase.from("events").select("id,name,category").order("name"),
    supabase.from("students").select("*").order("name")
  ]);

  if (seasonResult.error) throw new Error(`Could not load seasons: ${seasonResult.error.message}`);
  if (eventResult.error) throw new Error(`Could not load events: ${eventResult.error.message}`);
  if (studentResult.error) throw new Error(`Could not load students: ${studentResult.error.message}`);

  const seasons = ((seasonResult.data ?? []) as DbRow[]).map(mapSeason);
  const events = testoffEventOptions((eventResult.data ?? []) as DbRow[]);
  const students: TestoffStudentOption[] = ((studentResult.data ?? []) as DbRow[]).filter((row) => row.is_active !== false).map((row) => ({
    id: stringValue(row.id),
    name: stringValue(row.name, "Unknown student"),
    grade: numberValue(row.grade, 9)
  }));

  return {
    configured: true,
    activeSeasonId: seasons.find((season) => season.isActive)?.id,
    seasons,
    events,
    students
  };
}
