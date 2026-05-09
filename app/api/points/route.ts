import { NextResponse } from "next/server";
import { calculateActivityPoints } from "@/lib/activity";
import { mockPointLogs } from "@/lib/seed";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    studentId?: string;
    activityType?: ActivityType;
    minutes?: number;
    quantity?: number;
    customPoints?: number;
  };

  if (!body.studentId || !body.activityType) {
    return NextResponse.json({ ok: false, error: "Student and activity are required." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const submissionsToday = mockPointLogs.filter(
    (log) => log.studentId === body.studentId && log.submittedAt.slice(0, 10) === today
  ).length;

  if (submissionsToday >= 10) {
    return NextResponse.json({ ok: false, error: "Daily submission limit reached." }, { status: 429 });
  }

  const points = calculateActivityPoints({
    activityType: body.activityType,
    minutes: body.minutes,
    quantity: body.quantity,
    customPoints: body.customPoints
  });

  if (points <= 0) {
    return NextResponse.json({ ok: false, error: "Point value must be greater than zero." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.from("grind_points").insert({
      student_id: body.studentId,
      activity_type: body.activityType,
      points,
      minutes: body.minutes ?? 0,
      quantity: body.quantity ?? null,
      is_approved: false
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: `${points} points submitted for officer approval.`,
    points
  });
}
