import { NextResponse } from "next/server";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import { normalizeEventName, roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TestoffResultInput {
  studentId?: string;
  rawScore?: number;
  notes?: string;
}

interface TestoffRequestBody {
  seasonId?: number;
  seasonName?: string;
  eventId?: number;
  eventName?: string;
  eventCategory?: "study" | "build";
  name?: string;
  date?: string;
  maxScore?: number;
  weight?: number;
  notes?: string;
  results?: TestoffResultInput[];
}

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function seasonDates(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  const startYear = parsed.getUTCMonth() >= 6 ? year : year - 1;
  return {
    startDate: `${startYear}-07-01`,
    endDate: `${startYear + 1}-06-30`,
    defaultName: `${startYear}-${String(startYear + 1).slice(-2)}`
  };
}

function rankedResults(results: Array<{ studentId: string; rawScore: number; notes?: string }>) {
  const sorted = [...results].sort(
    (left, right) => right.rawScore - left.rawScore || left.studentId.localeCompare(right.studentId)
  );
  let displayedRank = 0;
  let previousScore: number | undefined;

  return sorted.map((result, index) => {
    if (previousScore === undefined || Math.abs(result.rawScore - previousScore) > 0.0005) {
      displayedRank = index + 1;
      previousScore = result.rawScore;
    }
    return { ...result, rank: displayedRank };
  });
}

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return failure("Testoff entry requires the Vercel/Supabase deployment.", 503);
  }

  const currentUser = await getAuthenticatedStudent();
  if (!currentUser) return failure("Sign in before entering testoff scores.", 401);
  if (!roleMeets(currentUser.role, "officer")) return failure("Officer access is required.", 403);

  let body: TestoffRequestBody;
  try {
    body = (await request.json()) as TestoffRequestBody;
  } catch {
    return failure("The request body must be valid JSON.", 400);
  }

  const name = body.name?.trim();
  const date = body.date?.trim();
  const eventId = Number(body.eventId);
  const eventName = body.eventName?.trim();
  const eventCategory = body.eventCategory === "build" ? "build" : "study";
  const maxScore = Number(body.maxScore);
  const weight = Number(body.weight ?? 1);
  const requestedSeasonId = Number(body.seasonId);
  const requestedSeasonName = body.seasonName?.trim();

  if (!name || name.length > 120) return failure("Enter a session name up to 120 characters.", 400);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00Z`).getTime())) {
    return failure("Enter a valid session date.", 400);
  }
  const hasExistingEvent = Number.isInteger(eventId) && eventId > 0;
  if (!hasExistingEvent && (!eventName || eventName.length > 120)) {
    return failure("Choose an event or enter a new event name up to 120 characters.", 400);
  }
  if (!hasExistingEvent && !normalizeEventName(eventName ?? "")) {
    return failure("Enter a valid event name.", 400);
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0) return failure("Maximum score must be greater than zero.", 400);
  if (!Number.isFinite(weight) || weight <= 0 || weight > 10) {
    return failure("Weight must be greater than zero and no more than 10.", 400);
  }

  const rawResults = Array.isArray(body.results) ? body.results : [];
  const results = rawResults.flatMap((entry) => {
    const studentId = entry.studentId?.trim();
    const rawScore = Number(entry.rawScore);
    if (!studentId || !Number.isFinite(rawScore)) return [];
    return [{ studentId, rawScore, notes: entry.notes?.trim() || undefined }];
  });

  if (results.length === 0) return failure("Enter at least one student score.", 400);
  if (new Set(results.map((result) => result.studentId)).size !== results.length) {
    return failure("Each student can appear only once in a testoff session.", 400);
  }
  if (results.some((result) => result.rawScore < 0 || result.rawScore > maxScore)) {
    return failure(`Scores must be between 0 and ${maxScore}.`, 400);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return failure("SUPABASE_SERVICE_ROLE_KEY is missing.", 503);

  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select("*")
    .in("id", results.map((result) => result.studentId));
  if (studentError) return failure(studentError.message, 500);
  if ((studentRows ?? []).length !== results.length || (studentRows ?? []).some((student) => student.is_active === false)) {
    return failure("One or more selected students no longer exist or are archived.", 400);
  }

  let event: { id: number; name: string } | null = null;
  if (hasExistingEvent) {
    const { data, error } = await supabase
      .from("events")
      .select("id,name")
      .eq("id", eventId)
      .maybeSingle();
    if (error) return failure(error.message, 500);
    if (data) event = { id: Number(data.id), name: String(data.name) };
  } else {
    const canonicalName = normalizeEventName(eventName ?? "");
    const { data: existingEvents, error: existingEventError } = await supabase
      .from("events")
      .select("id,name");
    if (existingEventError) return failure(existingEventError.message, 500);

    const canonicalMatches = (existingEvents ?? []).filter(
      (candidate) => normalizeEventName(String(candidate.name)) === canonicalName
    );
    const canonicalMatch =
      canonicalMatches.find((candidate) => String(candidate.name).toLowerCase() === eventName?.toLowerCase()) ??
      canonicalMatches[0];

    if (canonicalMatch) {
      event = { id: Number(canonicalMatch.id), name: String(canonicalMatch.name) };
    } else {
      const { data: createdEvent, error: createEventError } = await supabase
        .from("events")
        .upsert({ name: eventName, category: eventCategory }, { onConflict: "name" })
        .select("id,name")
        .single();
      if (createEventError) return failure(createEventError.message, 500);
      if (createdEvent) event = { id: Number(createdEvent.id), name: String(createdEvent.name) };
    }
  }
  if (!event) return failure("The selected event no longer exists.", 404);
  const resolvedEventId = event.id;

  let season: { id: number; name: string } | null = null;
  if (Number.isInteger(requestedSeasonId) && requestedSeasonId > 0) {
    const { data, error } = await supabase
      .from("seasons")
      .select("id,name")
      .eq("id", requestedSeasonId)
      .maybeSingle();
    if (error) return failure(error.message, 500);
    if (!data) return failure("The selected season no longer exists.", 404);
    season = { id: Number(data.id), name: String(data.name) };
  } else {
    const dates = seasonDates(date);
    const seasonName = requestedSeasonName || dates.defaultName;
    if (seasonName.length > 80) return failure("Season name must be 80 characters or fewer.", 400);

    const { data: existingSeason, error: existingError } = await supabase
      .from("seasons")
      .select("id,name")
      .ilike("name", seasonName)
      .limit(1)
      .maybeSingle();
    if (existingError) return failure(existingError.message, 500);

    if (existingSeason) {
      season = { id: Number(existingSeason.id), name: String(existingSeason.name) };
    } else {
      const { data: activeSeason, error: activeError } = await supabase
        .from("seasons")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (activeError) return failure(activeError.message, 500);

      const { data: createdSeason, error: createSeasonError } = await supabase
        .from("seasons")
        .insert({
          name: seasonName,
          start_date: dates.startDate,
          end_date: dates.endDate,
          is_active: !activeSeason
        })
        .select("id,name")
        .single();
      if (createSeasonError || !createdSeason) {
        return failure(createSeasonError?.message ?? "Could not create the season.", 500);
      }
      if (activeSeason && Number(activeSeason.id) !== Number(createdSeason.id)) {
        const { error: deactivateError } = await supabase
          .from("seasons")
          .update({ is_active: false })
          .eq("id", activeSeason.id);
        if (deactivateError) {
          await supabase.from("seasons").delete().eq("id", createdSeason.id);
          return failure(deactivateError.message, 500);
        }
        const { error: activateError } = await supabase
          .from("seasons")
          .update({ is_active: true })
          .eq("id", createdSeason.id);
        if (activateError) {
          await supabase.from("seasons").update({ is_active: true }).eq("id", activeSeason.id);
          await supabase.from("seasons").delete().eq("id", createdSeason.id);
          return failure(activateError.message, 500);
        }
      }
      season = { id: Number(createdSeason.id), name: String(createdSeason.name) };
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from("testoff_sessions")
    .insert({
      season_id: season.id,
      event_id: resolvedEventId,
      name,
      date,
      max_score: maxScore,
      weight,
      notes: body.notes?.trim() || null,
      created_by: currentUser.id
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    const status = sessionError?.code === "23505" ? 409 : 500;
    return failure(
      sessionError?.code === "23505"
        ? "A testoff with this season, event, name, and date already exists."
        : sessionError?.message ?? "Could not create the testoff session.",
      status
    );
  }

  const ranked = rankedResults(results);
  const { data: savedResults, error: resultError } = await supabase
    .from("testoff_results")
    .insert(
      ranked.map((result) => ({
        session_id: session.id,
        student_id: result.studentId,
        raw_score: result.rawScore,
        rank: result.rank,
        notes: result.notes ?? null,
        entered_by: currentUser.id
      }))
    )
    .select("id,student_id,raw_score,rank,ranking_score");

  if (resultError) {
    await supabase.from("testoff_sessions").delete().eq("id", session.id);
    return failure(resultError.message, 500);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "testoff.create",
    target: `${String(event.name)} / ${name}`,
    reason: `${season.name} testoff entry`,
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "testoff_sessions",
    entity_id: String(session.id),
    payload_after: {
      session: {
        id: Number(session.id),
        season_id: season.id,
        event_id: resolvedEventId,
        name,
        date,
        max_score: maxScore,
        weight,
        notes: body.notes?.trim() || null,
        created_by: currentUser.id
      },
      results: savedResults ?? ranked
    },
    undo_action: "testoff.delete",
    is_reversible: true
  });

  if (auditError) {
    await supabase.from("testoff_sessions").delete().eq("id", session.id);
    return failure("The testoff was rolled back because its undo record could not be saved.", 500);
  }

  invalidateAnalyticsCache();
  return NextResponse.json(
    {
      ok: true,
      message: `${name} saved with ${ranked.length} ranked score${ranked.length === 1 ? "" : "s"}.`,
      sessionId: session.id
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  if (!hasSupabaseConfig()) {
    return failure("Testoff correction requires the Vercel/Supabase deployment.", 503);
  }

  const currentUser = await getAuthenticatedStudent();
  if (!currentUser) return failure("Sign in before correcting testoff scores.", 401);
  if (!roleMeets(currentUser.role, "officer")) return failure("Officer access is required.", 403);

  const body = (await request.json().catch(() => null)) as { sessionId?: number } | null;
  const sessionId = Number(body?.sessionId);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return failure("A valid testoff session ID is required.", 400);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return failure("SUPABASE_SERVICE_ROLE_KEY is missing.", 503);

  const { data: session, error: loadError } = await supabase
    .from("testoff_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if (loadError) return failure(loadError.message, 500);
  if (!session) return failure("This testoff session no longer exists.", 404);

  const { data: results, error: resultsError } = await supabase
    .from("testoff_results")
    .select("*")
    .eq("session_id", sessionId);
  if (resultsError) return failure(resultsError.message, 500);

  const { error: deleteError } = await supabase.from("testoff_sessions").delete().eq("id", sessionId);
  if (deleteError) return failure(deleteError.message, 500);

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "testoff.delete",
    target: String(session.name),
    reason: "Officer deleted a testoff session for correction and re-entry.",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "testoff_sessions",
    entity_id: String(sessionId),
    payload_before: { session, results: results ?? [] },
    undo_action: "testoff.restore",
    is_reversible: true
  });

  if (auditError) {
    const { error: restoreSessionError } = await supabase.from("testoff_sessions").insert(session);
    if (!restoreSessionError && results && results.length > 0) {
      await supabase.from("testoff_results").insert(results);
    }
    return failure("The deletion was rolled back because its undo record could not be saved.", 500);
  }

  invalidateAnalyticsCache();
  return NextResponse.json({
    ok: true,
    message: `${String(session.name)} deleted. Re-enter the corrected scores from Enter Scores.`
  });
}
