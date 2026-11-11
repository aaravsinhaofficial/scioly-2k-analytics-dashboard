import { NextResponse } from "next/server";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { parseTournamentInput, placementScoresForPreview } from "@/lib/tournament-import";
import { resolveTournamentParticipants, type ParticipantSelection } from "@/lib/tournament-participant-resolution";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { mockStudents, mockTeamMembers, mockTeams, schoolName } from "@/lib/seed";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import type { TournamentParticipantCandidate, TournamentSourceType } from "@/lib/types";
import { normalizeEventName, normalizeName, roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

function schoolMatchesTracker(value: string) {
  const clean = (name: string) => normalizeName(name.replace(/\s+(team\s*)?[a-c]$/i, "").trim());
  const candidate = clean(value);
  const aliases = [
    schoolName,
    ...(process.env.TRACKED_SCHOOL_ALIASES ?? "")
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean)
  ].map(clean);

  return aliases.some((alias) => candidate === alias);
}

async function loadParticipantCandidates(supabase: ReturnType<typeof getSupabaseAdmin>) {
  if (!supabase) {
    const teamById = new Map(mockTeams.map((team) => [team.id, team]));
    const membershipByStudent = new Map(mockTeamMembers.map((membership) => [membership.studentId, membership.teamId]));
    return mockStudents.map((student) => ({
      id: student.id,
      name: student.name,
      teamDesignation: teamById.get(membershipByStudent.get(student.id) ?? "")?.teamDesignation ?? "-",
      profileEvents: student.profileEvents ?? []
    } satisfies TournamentParticipantCandidate));
  }

  const [studentResult, teamResult, membershipResult] = await Promise.all([
    supabase.from("students").select("*"),
    supabase.from("teams").select("id,team_designation"),
    supabase.from("team_members").select("team_id,student_id")
  ]);
  const error = studentResult.error ?? teamResult.error ?? membershipResult.error;
  if (error) throw new Error(error.message);
  const teamDesignationById = new Map((teamResult.data ?? []).map((team) => [String(team.id), String(team.team_designation)]));
  const teamIdByStudent = new Map((membershipResult.data ?? []).map((membership) => [String(membership.student_id), String(membership.team_id)]));
  return (studentResult.data ?? []).filter((student) => student.is_active !== false).map((student) => ({
    id: String(student.id),
    name: String(student.name),
    teamDesignation: teamDesignationById.get(teamIdByStudent.get(String(student.id)) ?? "") ?? "-",
    profileEvents: Array.isArray(student.profile_events) ? student.profile_events.filter((event: unknown): event is string => typeof event === "string") : []
  } satisfies TournamentParticipantCandidate));
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON import request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: "Send a valid import request." }, { status: 400 });
  }
  const body = payload as {
    rawInput?: string;
    commit?: boolean;
    mode?: TournamentSourceType;
    tournamentName?: string;
    date?: string;
    medalCutoff?: number;
    participationPoints?: number;
    participantSelections?: Record<string, ParticipantSelection>;
  };

  if (typeof body.rawInput !== "string" || !body.rawInput.trim()) {
    return NextResponse.json({ ok: false, error: "Tournament input is required." }, { status: 400 });
  }
  if (body.rawInput.length > 2_000_000 ||
    (body.commit !== undefined && typeof body.commit !== "boolean") ||
    (body.mode !== undefined && body.mode !== "manual" && body.mode !== "duosmium_csv") ||
    [body.tournamentName, body.date].some((value) => value !== undefined && typeof value !== "string") ||
    [body.medalCutoff, body.participationPoints].some((value) => value !== undefined && (!Number.isSafeInteger(value) || value < 0))
  ) {
    return NextResponse.json({ ok: false, error: "Use valid tournament fields and nonnegative whole numbers for points and medal cutoff." }, { status: 400 });
  }
  if (body.participantSelections !== undefined && (
    !body.participantSelections || typeof body.participantSelections !== "object" || Array.isArray(body.participantSelections) ||
    Object.values(body.participantSelections).some((selection) =>
      !selection || typeof selection !== "object" || typeof selection.confirmed !== "boolean" ||
      !Array.isArray(selection.studentIds) || selection.studentIds.some((id) => typeof id !== "string")
    )
  )) {
    return NextResponse.json({ ok: false, error: "Participant selections are invalid." }, { status: 400 });
  }

  const authenticatedUser = await getAuthenticatedStudent();
  const currentUser = authenticatedUser ?? (isDemoMode() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before importing tournaments." }, { status: 401 });
  }
  const mode = body.mode === "manual" ? "manual" : "duosmium_csv";

  if (mode === "manual" && currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Manual tournament dumps are admin-only." }, { status: 403 });
  }

  if (!roleMeets(currentUser.role, "officer")) {
    return NextResponse.json({ ok: false, error: "Tournament imports require officer access." }, { status: 403 });
  }

  const parsedPreview = await parseTournamentInput(body.rawInput, {
    mode,
    tournamentName: body.tournamentName,
    date: body.date,
    medalCutoff: body.medalCutoff,
    participationPoints: body.participationPoints
  });
  const supabase = getSupabaseAdmin();
  if (!supabase && !isDemoMode()) {
    return NextResponse.json({ ok: false, error: "Tournament storage is unavailable. Please try again after the backend is configured." }, { status: 503 });
  }
  let candidates: TournamentParticipantCandidate[];
  try {
    candidates = await loadParticipantCandidates(supabase);
  } catch (caught) {
    return NextResponse.json({ ok: false, error: caught instanceof Error ? caught.message : "Could not load the current roster." }, { status: 500 });
  }
  const preview = resolveTournamentParticipants({
    preview: parsedPreview,
    candidates,
    selections: body.participantSelections,
    isLocalSchool: schoolMatchesTracker,
    localSchoolName: schoolName
  });

  if (!body.commit) {
    return NextResponse.json({
      ok: true,
      preview,
      message: "Preview ready. Review missing fields and ambiguous names before committing."
    });
  }

  if (!preview.canCommit) {
    return NextResponse.json(
      {
        ok: false,
        preview,
        error: `Commit blocked: ${preview.blockers.join(" ")}`
      },
      { status: 422 }
    );
  }

  if (supabase) {
    const localPerformances = placementScoresForPreview(preview).filter(
      (performance) => schoolMatchesTracker(performance.schoolName) && performance.participantResolution?.status === "matched"
    );
    if (localPerformances.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          preview,
          error: `No rows matched ${schoolName}. Add an exact school alias with TRACKED_SCHOOL_ALIASES if the CSV uses a different name.`
        },
        { status: 422 }
      );
    }

    const { data: existingEvents, error: existingEventsError } = await supabase
      .from("events")
      .select("id,name,category");
    if (existingEventsError) {
      return NextResponse.json({ ok: false, preview, error: existingEventsError.message }, { status: 500 });
    }
    const eventsByCanonicalName = new Map<string, Array<{ id: number; name: string; category: string }>>();
    for (const event of existingEvents ?? []) {
      const key = normalizeEventName(String(event.name));
      const rows = eventsByCanonicalName.get(key) ?? [];
      rows.push({ id: Number(event.id), name: String(event.name), category: String(event.category) });
      eventsByCanonicalName.set(key, rows);
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from("tournaments")
      .insert({
        name: preview.tournamentName,
        date: preview.date,
        avg_scioly_elo: preview.avgSciolyElo,
        sos_multiplier: preview.sosMultiplier,
        benchmark_school: preview.benchmarkComparison.benchmarkSchool,
        benchmark_elo: preview.benchmarkComparison.benchmarkElo,
        benchmark_source: preview.benchmarkComparison.source,
        relative_difficulty_multiplier: preview.benchmarkComparison.relativeDifficultyMultiplier,
        attending_schools: preview.attendingSchools,
        medal_cutoff: preview.medalCutoff,
        participation_points: preview.participationPoints,
        source_type: preview.sourceType
      })
      .select("id")
      .single();

    if (tournamentError) {
      return NextResponse.json({ ok: false, preview, error: tournamentError.message }, { status: 500 });
    }

    const createdEventIds: number[] = [];
    const cleanupImport = async () => {
      await supabase.from("tournaments").delete().eq("id", tournament.id);
      if (createdEventIds.length > 0) await supabase.from("events").delete().in("id", createdEventIds);
    };
    for (const performance of localPerformances) {
      const canonicalEventName = normalizeEventName(performance.eventName);
      const matchingEvents = eventsByCanonicalName.get(canonicalEventName) ?? [];
      if (matchingEvents.length > 1) {
        await cleanupImport();
        return NextResponse.json({ ok: false, preview, error: `Multiple canonical events match ${performance.eventName}.` }, { status: 409 });
      }
      let event = matchingEvents[0];
      if (event && event.category !== performance.category) {
        await cleanupImport();
        return NextResponse.json({ ok: false, preview, error: `${performance.eventName} already exists with a different category.` }, { status: 409 });
      }
      if (!event) {
        const created = await supabase.from("events").insert({ name: performance.eventName, category: performance.category }).select("id,name,category").single();
        if (created.error || !created.data) {
          await cleanupImport();
          return NextResponse.json({ ok: false, preview, error: created.error?.message ?? `Could not create ${performance.eventName}.` }, { status: 500 });
        }
        event = created.data;
        createdEventIds.push(Number(event.id));
        eventsByCanonicalName.set(canonicalEventName, [{ id: Number(event.id), name: String(event.name), category: String(event.category) }]);
      }

      for (const participant of performance.participantResolution?.selected ?? []) {
        const { error: performanceError } = await supabase.from("performances").upsert(
          {
            student_id: participant.id,
            tournament_id: tournament.id,
            event_id: event.id,
            rank: performance.rank,
            placement_score: performance.placementScore,
            participant_names: performance.participantResolution?.selected.map((candidate) => candidate.name) ?? performance.studentNames,
            is_medal: performance.isMedal,
            medal_cutoff: performance.medalCutoff,
            participation_points: performance.participationPoints,
            medal_points: performance.medalPoints,
            event_points: performance.eventPoints,
            team_designation: performance.teamDesignation
          },
          { onConflict: "student_id,tournament_id,event_id" }
        );
        if (performanceError) {
          await cleanupImport();
          return NextResponse.json({ ok: false, preview, error: performanceError.message }, { status: 500 });
        }
      }
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: "tournament.import",
      target: preview.tournamentName,
      reason: preview.sourceType === "manual" ? "Manual tournament dump committed" : "Duosmium CSV committed",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      entity_table: "tournaments",
      entity_id: String(tournament.id),
      payload_after: { ...preview, createdEventIds },
      undo_action: "tournament.delete",
      is_reversible: true
    });
    if (auditError) {
      await cleanupImport();
      return NextResponse.json(
        { ok: false, preview, error: "The import was rolled back because its undo record could not be saved." },
        { status: 500 }
      );
    }
    invalidateAnalyticsCache();
  }

  return NextResponse.json({
    ok: true,
    preview,
    message: supabase
      ? "Tournament committed. Readiness and team summaries will update from the matched results."
      : "Demo commit complete. Add Supabase credentials to persist imports."
  });
}
