import { NextResponse } from "next/server";
import { activityLabels, calculateActivityPoints } from "@/lib/activity";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import { mockPointLogs } from "@/lib/seed";
import { getSupabaseAdmin, hasSupabaseConfig, isDemoMode } from "@/lib/supabase";
import type { ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    studentId?: string;
    activityType?: ActivityType;
    minutes?: number;
    quantity?: number;
    customPoints?: number;
    customLabel?: string;
    customCategoryId?: number;
  } | null;

  if (!body || !body.activityType || !Object.prototype.hasOwnProperty.call(activityLabels, body.activityType)) {
    return NextResponse.json({ ok: false, error: "A valid activity is required." }, { status: 400 });
  }

  const numericInputs = [
    ["Minutes", body.minutes],
    ["Quantity", body.quantity],
    ["Custom points", body.customPoints]
  ] as const;

  for (const [label, value] of numericInputs) {
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      return NextResponse.json(
        { ok: false, error: `${label} must be a non-negative number.` },
        { status: 400 }
      );
    }
  }

  if (
    body.customCategoryId !== undefined &&
    (!Number.isInteger(body.customCategoryId) || body.customCategoryId <= 0)
  ) {
    return NextResponse.json(
      { ok: false, error: "Custom category must be a positive integer." },
      { status: 400 }
    );
  }

  if (body.customLabel !== undefined && typeof body.customLabel !== "string") {
    return NextResponse.json({ ok: false, error: "Custom label must be text." }, { status: 400 });
  }

  const authenticatedStudent = await getAuthenticatedStudent();
  const currentUser = authenticatedStudent ?? (isDemoMode() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before submitting points." }, { status: 401 });
  }

  if (body.studentId !== undefined && body.studentId !== currentUser.id) {
    return NextResponse.json(
      { ok: false, error: "You can only submit points for your own account." },
      { status: 403 }
    );
  }

  const studentId = currentUser.id;
  const today = new Date().toISOString().slice(0, 10);
  const submissionsToday = mockPointLogs.filter(
    (log) => log.studentId === studentId && log.submittedAt.slice(0, 10) === today
  ).length;

  if (isDemoMode() && submissionsToday >= 10) {
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
  if (hasSupabaseConfig() && !supabase) {
    return NextResponse.json(
      { ok: false, error: "Point storage is not configured for this deployment." },
      { status: 503 }
    );
  }

  let acceptedPoints = points;
  let insertedLog: Record<string, unknown> | null = null;
  if (supabase) {
    const { data, error } = await supabase
      .from("grind_points")
      .insert({
        student_id: studentId,
        activity_type: body.activityType,
        points,
        minutes: body.minutes ?? 0,
        quantity: body.quantity ?? null,
        custom_label: body.activityType === "custom_activity" ? body.customLabel?.trim() || "Custom Activity" : null,
        custom_category_id: body.customCategoryId ?? null,
        metadata: body.activityType === "custom_activity" ? { requestedLabel: body.customLabel ?? null } : {},
        is_approved: false
      })
      .select("*")
      .single();

    if (error) {
      const limitReached = error.message.toLowerCase().includes("daily point log limit");
      return NextResponse.json(
        { ok: false, error: limitReached ? "Daily submission limit reached." : error.message },
        { status: limitReached ? 429 : 500 }
      );
    }
    acceptedPoints = Number(data?.points ?? points);
    insertedLog = data as Record<string, unknown>;
    await supabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: "points.submit",
      target: `Point log #${String(data?.id ?? "")}`,
      reason: "Member practice submission",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      entity_table: "grind_points",
      entity_id: String(data?.id ?? ""),
      payload_after: insertedLog,
      undo_action: "points.delete",
      is_reversible: true
    });
  }

  return NextResponse.json({
    ok: true,
    message: `${acceptedPoints} points submitted for officer approval.`,
    points: acceptedPoints
  });
}
