import "server-only";

import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import type { AnalyticsDataset } from "@/lib/analytics";
import type {
  ActivityType,
  AuditLogEntry,
  EventCategory,
  EventDefinition,
  GrindPointLog,
  OvrSnapshot,
  Performance,
  PointLogStatus,
  SchoolElo,
  Student,
  Team,
  TeamMember,
  Tournament,
  TournamentSourceType,
  UserRole
} from "@/lib/types";

type DbRow = Record<string, unknown>;

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function userRole(value: unknown): UserRole {
  return value === "admin" || value === "officer" ? value : "viewer";
}

function eventCategory(value: unknown): EventCategory {
  return value === "build" ? "build" : "study";
}

function pointStatus(value: unknown): PointLogStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function tournamentSource(value: unknown): TournamentSourceType {
  return value === "manual" || value === "demo" ? value : "duosmium_csv";
}

function benchmarkTier(elo: number): "national" | "state" | "regional" | "local" {
  if (elo >= 2000) return "national";
  if (elo >= 1700) return "state";
  if (elo >= 1300) return "regional";
  return "local";
}

function schoolElos(value: unknown): SchoolElo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as DbRow;
    const schoolName = stringValue(row.schoolName ?? row.school_name);
    if (!schoolName) return [];
    return [{ schoolName, elo: numberValue(row.elo, 1000) }];
  });
}

function studentFromDb(row: DbRow): Student {
  return {
    id: stringValue(row.id),
    name: stringValue(row.name, "Unnamed student"),
    email: stringValue(row.email),
    role: userRole(row.role),
    grade: numberValue(row.grade, 9),
    profilePictureUrl: stringValue(row.profile_picture_url) || undefined,
    ovrRating: numberValue(row.ovr_rating, 60),
    studyRating: optionalNumber(row.study_rating),
    buildRating: optionalNumber(row.build_rating),
    potentialRating: optionalNumber(row.potential_rating),
    totalPoints: numberValue(row.total_points),
    profileEvents: stringArray(row.profile_events),
    prevOvr: numberValue(row.prev_ovr, numberValue(row.ovr_rating, 60)),
    prevAvgPlacement: optionalNumber(row.prev_avg_placement),
    lastSnapshotDate: stringValue(row.last_snapshot_date) || undefined,
    createdAt: stringValue(row.created_at, new Date(0).toISOString())
  };
}

const databasePageSize = 1000;

async function loadAllRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  table: string,
  orderBy = "id"
): Promise<DbRow[]> {
  const rows: DbRow[] = [];

  for (let start = 0; ; start += databasePageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: true })
      .range(start, start + databasePageSize - 1);

    if (error) {
      throw new Error(`Could not load ${table}: ${error.message}`);
    }

    const page = (data ?? []) as DbRow[];
    rows.push(...page);
    if (page.length < databasePageSize) break;
  }

  return rows;
}

export async function loadSupabaseAnalyticsDataset(): Promise<AnalyticsDataset> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const reason = hasSupabaseConfig()
      ? "SUPABASE_SERVICE_ROLE_KEY is missing."
      : "Supabase is not configured.";
    throw new Error(`Cannot load live SciOly data: ${reason}`);
  }

  const [
    studentResult,
    teamResult,
    memberResult,
    eventResult,
    tournamentResult,
    performanceRows,
    pointRows,
    snapshotRows,
    auditRows,
    seasonRows,
    testoffSessionRows,
    testoffResultRows
  ] = await Promise.all([
    supabase.from("students").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("team_members").select("*"),
    supabase.from("events").select("*"),
    supabase.from("tournaments").select("*"),
    loadAllRows(supabase, "performances"),
    loadAllRows(supabase, "grind_points"),
    loadAllRows(supabase, "ovr_snapshots"),
    loadAllRows(supabase, "audit_logs"),
    loadAllRows(supabase, "seasons"),
    loadAllRows(supabase, "testoff_sessions"),
    loadAllRows(supabase, "testoff_results")
  ]);

  const baseResults = [studentResult, teamResult, memberResult, eventResult, tournamentResult];
  const baseNames = ["students", "teams", "team_members", "events", "tournaments"];
  baseResults.forEach((result, index) => {
    if (result.error) {
      throw new Error(`Could not load ${baseNames[index]}: ${result.error.message}`);
    }
  });

  const students = ((studentResult.data ?? []) as DbRow[]).map(studentFromDb);
  const studentById = new Map(students.map((student) => [student.id, student]));

  const teams: Team[] = ((teamResult.data ?? []) as DbRow[]).map((row) => ({
    id: stringValue(row.id),
    schoolName: stringValue(row.school_name),
    teamDesignation: stringValue(row.team_designation, "A"),
    teamOvr: numberValue(row.team_ovr, 60),
    version: numberValue(row.version, 1)
  }));

  const teamMembers: TeamMember[] = ((memberResult.data ?? []) as DbRow[]).map((row) => ({
    teamId: stringValue(row.team_id),
    studentId: stringValue(row.student_id)
  }));

  const events: EventDefinition[] = ((eventResult.data ?? []) as DbRow[]).map((row) => ({
    id: numberValue(row.id),
    name: stringValue(row.name),
    category: eventCategory(row.category)
  }));

  const tournaments: Tournament[] = ((tournamentResult.data ?? []) as DbRow[]).map((row) => {
    const benchmarkElo = numberValue(row.benchmark_elo, 1000);
    const source = row.benchmark_source === "direct" ? "direct" : "equivalent";
    const benchmarkSchool = stringValue(row.benchmark_school, "Baseline School");
    const relativeDifficultyMultiplier = numberValue(row.relative_difficulty_multiplier, 1);

    return {
      id: numberValue(row.id),
      name: stringValue(row.name),
      date: stringValue(row.date),
      avgSciolyElo: numberValue(row.avg_scioly_elo, 1000),
      sosMultiplier: numberValue(row.sos_multiplier, 1),
      benchmarkComparison: {
        benchmarkSchool,
        benchmarkElo,
        benchmarkTier: benchmarkTier(benchmarkElo),
        source,
        relativeDifficultyMultiplier,
        explanation: `${source === "direct" ? "Direct" : "Equivalent"} comparison against ${benchmarkSchool}.`
      },
      attendingSchools: schoolElos(row.attending_schools),
      medalCutoff: numberValue(row.medal_cutoff, 6),
      participationPoints: numberValue(row.participation_points, 10),
      sourceType: tournamentSource(row.source_type)
    };
  });

  const performances: Performance[] = performanceRows.map((row) => ({
    id: numberValue(row.id),
    studentId: stringValue(row.student_id),
    tournamentId: numberValue(row.tournament_id),
    eventId: numberValue(row.event_id),
    rank: numberValue(row.rank),
    placementScore: numberValue(row.placement_score),
    participantNames: stringArray(row.participant_names),
    isMedal: Boolean(row.is_medal),
    medalCutoff: numberValue(row.medal_cutoff, 6),
    participationPoints: numberValue(row.participation_points, 10),
    medalPoints: numberValue(row.medal_points),
    eventPoints: numberValue(row.event_points),
    teamDesignation: stringValue(row.team_designation, "A"),
    createdAt: stringValue(row.created_at, new Date(0).toISOString())
  }));

  const pointLogs: GrindPointLog[] = pointRows.map((row) => ({
    id: numberValue(row.id),
    studentId: stringValue(row.student_id),
    activityType: stringValue(row.activity_type, "custom_activity") as ActivityType,
    points: numberValue(row.points),
    minutes: numberValue(row.minutes),
    quantity: optionalNumber(row.quantity),
    customLabel: stringValue(row.custom_label) || undefined,
    customCategoryId: optionalNumber(row.custom_category_id),
    status: pointStatus(row.status),
    submittedAt: stringValue(row.submitted_at, new Date(0).toISOString()),
    approvedAt: stringValue(row.approved_at) || undefined,
    approvedBy: stringValue(row.approved_by) || undefined,
    notes: stringValue(row.notes) || undefined,
    metadata: recordValue(row.metadata)
  }));

  const snapshots: OvrSnapshot[] = snapshotRows.map((row) => ({
    id: numberValue(row.id),
    studentId: stringValue(row.student_id),
    ovrValue: numberValue(row.ovr_value, 60),
    totalPoints: numberValue(row.total_points),
    avgPlacement: optionalNumber(row.avg_placement),
    medalCount: optionalNumber(row.medal_count),
    potentialRating: optionalNumber(row.potential_rating),
    recordedAt: stringValue(row.recorded_at, new Date(0).toISOString())
  }));

  const auditLogs: AuditLogEntry[] = auditRows.map((row) => {
    const actorId = stringValue(row.actor_id);
    return {
      id: numberValue(row.id),
      actorId,
      actorName: studentById.get(actorId)?.name ?? "System",
      action: stringValue(row.action),
      target: stringValue(row.target),
      reason: stringValue(row.reason) || undefined,
      ipAddress: stringValue(row.ip_address, "server"),
      entityTable: stringValue(row.entity_table) || undefined,
      entityId: stringValue(row.entity_id) || undefined,
      payloadBefore: recordValue(row.payload_before),
      payloadAfter: recordValue(row.payload_after),
      undoAction: stringValue(row.undo_action) || undefined,
      isReversible: Boolean(row.is_reversible),
      isReversed: Boolean(row.reversed_at),
      reversedAt: stringValue(row.reversed_at) || undefined,
      reversedBy: stringValue(row.reversed_by) || undefined,
      reversalOf: optionalNumber(row.reversal_of),
      createdAt: stringValue(row.created_at, new Date(0).toISOString())
    };
  });

  const activeSeasonIds = new Set(
    seasonRows.filter((row) => Boolean(row.is_active)).map((row) => numberValue(row.id))
  );
  const sessionById = new Map(
    testoffSessionRows.map((row) => [numberValue(row.id), {
      seasonId: numberValue(row.season_id),
      weight: numberValue(row.weight, 1)
    }])
  );
  const testoffScores = testoffResultRows.flatMap((row) => {
    const session = sessionById.get(numberValue(row.session_id));
    if (!session) return [];
    return [{
      studentId: stringValue(row.student_id),
      score: numberValue(row.ranking_score),
      weight: session.weight,
      seasonId: session.seasonId,
      isActiveSeason: activeSeasonIds.has(session.seasonId)
    }];
  });

  return {
    students,
    teams,
    teamMembers,
    events,
    tournaments,
    performances,
    pointLogs,
    snapshots,
    auditLogs,
    testoffScores,
    now: new Date()
  };
}
