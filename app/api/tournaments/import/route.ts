import { NextResponse } from "next/server";
import { parseTournamentInput, placementScoresForPreview } from "@/lib/tournament-import";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    rawInput?: string;
    commit?: boolean;
  };

  if (!body.rawInput?.trim()) {
    return NextResponse.json({ ok: false, error: "Tournament input is required." }, { status: 400 });
  }

  const preview = await parseTournamentInput(body.rawInput);

  if (!body.commit) {
    return NextResponse.json({
      ok: true,
      preview,
      message: "Preview ready. Review missing fields and ambiguous names before committing."
    });
  }

  if (preview.missingFields.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        preview,
        error: "Commit blocked until required fields are complete."
      },
      { status: 422 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
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
        attending_schools: preview.attendingSchools
      })
      .select("id")
      .single();

    if (tournamentError) {
      return NextResponse.json({ ok: false, preview, error: tournamentError.message }, { status: 500 });
    }

    for (const performance of placementScoresForPreview(preview)) {
      const normalizedEmail = `${normalizeName(performance.studentName).replace(/\s+/g, ".")}@local.scioly`;
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .ilike("name", performance.studentName)
        .maybeSingle();

      const studentId =
        student?.id ??
        (
          await supabase
            .from("students")
            .insert({
              name: performance.studentName,
              email: normalizedEmail,
              role: "viewer",
              grade: null
            })
            .select("id")
            .single()
        ).data?.id;

      const { data: event } = await supabase
        .from("events")
        .upsert({ name: performance.eventName, category: performance.category }, { onConflict: "name" })
        .select("id")
        .single();

      if (studentId && event?.id) {
        await supabase.from("performances").upsert(
          {
            student_id: studentId,
            tournament_id: tournament.id,
            event_id: event.id,
            rank: performance.rank,
            placement_score: performance.placementScore,
            team_designation: performance.teamDesignation
          },
          { onConflict: "student_id,tournament_id,event_id" }
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    preview,
    message: supabase
      ? "Tournament committed. Database triggers will recalculate OVR and teams."
      : "Demo commit complete. Add Supabase credentials to persist imports."
  });
}
