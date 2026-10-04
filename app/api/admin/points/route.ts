import { NextResponse } from "next/server";
import { activityLabels } from "@/lib/activity";
import { getCurrentDemoUser } from "@/lib/analytics";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { getAuthenticatedStudent } from "@/lib/auth";
import { mockPointLogs, mockStudents } from "@/lib/seed";
import {
  pointActivityDetailsFromMetadata,
  pointEvidenceForClient,
  storedPointEvidenceFromMetadata
} from "@/lib/point-evidence";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";
import type { ActivityType } from "@/lib/types";

export const dynamic = "force-dynamic";

function pointRow(
  row: Record<string, unknown>,
  studentNames: Map<string, string>
) {
  const studentId = String(row.student_id ?? "");
  const activityType = String(row.activity_type ?? "custom_activity") as ActivityType;
  const id = Number(row.id);
  return {
    id,
    studentId,
    studentName: studentNames.get(studentId) ?? "Unknown student",
    activityType,
    activity: String(row.custom_label ?? "") || activityLabels[activityType] || "Custom activity",
    customLabel: typeof row.custom_label === "string" ? row.custom_label : null,
    details: pointActivityDetailsFromMetadata(row.metadata) ?? null,
    points: Number(row.points ?? 0),
    minutes: Number(row.minutes ?? 0),
    quantity: typeof row.quantity === "number" ? row.quantity : null,
    status: String(row.status ?? "pending"),
    submittedAt: String(row.submitted_at ?? ""),
    notes: typeof row.notes === "string" ? row.notes : null,
    evidence: pointEvidenceForClient(id, row.metadata)
  };
}

const pointStatuses = new Set(["pending", "approved", "rejected"]);
const activityTypes = new Set<ActivityType>(Object.keys(activityLabels) as ActivityType[]);

function parseSubmittedAt(value: unknown) {
  if (typeof value !== "string" || value.length > 64) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return null;

  const earliestAllowed = Date.UTC(2000, 0, 1);
  const latestAllowed = Date.now() + 5 * 60 * 1000;
  if (time < earliestAllowed || time > latestAllowed) return null;
  return parsed.toISOString();
}

async function requireAdmin() {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) {
    return { error: NextResponse.json({ ok: false, error: "Sign in before managing points." }, { status: 401 }) };
  }
  if (currentUser.role !== "admin") {
    return { error: NextResponse.json({ ok: false, error: "Only admins can manage points for other students." }, { status: 403 }) };
  }
  return { currentUser };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId")?.trim() || null;
  const pointIdInput = url.searchParams.get("id");
  const pointId = pointIdInput === null ? null : Number(pointIdInput);
  if (pointId !== null && (!Number.isInteger(pointId) || pointId <= 0)) {
    return NextResponse.json({ ok: false, error: "Point log ID must be a positive whole number." }, { status: 400 });
  }
  const requestedLimit = Number(url.searchParams.get("limit") ?? 200);
  const limit = Number.isInteger(requestedLimit) ? Math.min(500, Math.max(1, requestedLimit)) : 200;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    const names = new Map(mockStudents.map((student) => [student.id, student.name]));
    const rows = mockPointLogs
      .filter((point) => pointId === null || point.id === pointId)
      .filter((point) => !studentId || point.studentId === studentId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .slice(0, limit)
      .map((point) => ({
        id: point.id,
        studentId: point.studentId,
        studentName: names.get(point.studentId) ?? "Unknown student",
        activityType: point.activityType,
        activity: point.customLabel || point.activityType.replaceAll("_", " "),
        customLabel: point.customLabel ?? null,
        details: point.details ?? null,
        points: point.points,
        minutes: point.minutes,
        quantity: point.quantity ?? null,
        status: point.status,
        submittedAt: point.submittedAt,
        notes: point.notes ?? null,
        evidence: point.evidence ?? []
      }));
    return NextResponse.json({ ok: true, rows }, { headers: { "cache-control": "private, no-store" } });
  }

  let query = supabase
    .from("grind_points")
    .select("id,student_id,activity_type,custom_label,points,minutes,quantity,status,submitted_at,notes,metadata")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (studentId) query = query.eq("student_id", studentId);
  if (pointId !== null) query = query.eq("id", pointId);

  const [pointResult, studentResult] = await Promise.all([
    query,
    supabase.from("students").select("id,name")
  ]);
  const error = pointResult.error ?? studentResult.error;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const studentNames = new Map(
    (studentResult.data ?? []).map((student) => [String(student.id), String(student.name)])
  );
  const rows = (pointResult.data ?? []).map((row) => pointRow(row as Record<string, unknown>, studentNames));
  return NextResponse.json({ ok: true, rows }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { currentUser } = auth;
  const body = (await request.json().catch(() => null)) as {
    studentId?: string;
    points?: number;
    minutes?: number;
    label?: string;
    reason?: string;
  } | null;

  const studentId = body?.studentId?.trim();
  const points = Number(body?.points);
  const minutes = Number(body?.minutes ?? 0);
  const label = body?.label?.trim();
  const reason = body?.reason?.trim();
  if (!studentId || !label || !reason) {
    return NextResponse.json({ ok: false, error: "Student, activity label, and reason are required." }, { status: 400 });
  }
  if (!Number.isInteger(points) || points < 1 || points > 500) {
    return NextResponse.json({ ok: false, error: "Points must be a whole number from 1 to 500." }, { status: 400 });
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
    return NextResponse.json({ ok: false, error: "Minutes must be a whole number from 0 to 240." }, { status: 400 });
  }
  if (label.length > 100 || reason.length > 500) {
    return NextResponse.json({ ok: false, error: "Activity labels are limited to 100 characters and reasons to 500." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const student = mockStudents.find((entry) => entry.id === studentId);
    if (!student) return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });
    return NextResponse.json({
      ok: true,
      persisted: false,
      message: `Demo: ${points} points staged for ${student.name}.`,
      row: {
        id: Date.now(), studentId, studentName: student.name, activityType: "custom_activity",
        activity: label, customLabel: label, points, minutes, quantity: null,
        status: "approved", submittedAt: new Date().toISOString(), notes: reason
      }
    });
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  if (studentError) return NextResponse.json({ ok: false, error: studentError.message }, { status: 500 });
  if (!student) return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });
  if (student.is_active === false) return NextResponse.json({ ok: false, error: "Restore this person before adding new points." }, { status: 409 });

  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("grind_points")
    .insert({
      student_id: studentId,
      activity_type: "custom_activity",
      custom_label: label,
      points,
      minutes,
      metadata: { source: "admin_manual" },
      status: "approved",
      is_approved: true,
      approved_at: now,
      approved_by: currentUser.id,
      notes: reason
    })
    .select("*")
    .single();
  if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "points.admin_create",
    target: `${student.name} · ${label}`,
    reason,
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "grind_points",
    entity_id: String(inserted.id),
    payload_after: inserted,
    undo_action: "points.delete",
    is_reversible: true
  });
  if (auditError) {
    const { error: rollbackError } = await supabase.from("grind_points").delete().eq("id", inserted.id);
    return NextResponse.json(
      { ok: false, error: rollbackError ? `Could not audit or roll back the point entry: ${auditError.message}; ${rollbackError.message}` : "The point entry was cancelled because its audit record could not be saved." },
      { status: 500 }
    );
  }

  invalidateAnalyticsCache();
  const names = new Map([[studentId, String(student.name)]]);
  return NextResponse.json({
    ok: true,
    persisted: true,
    message: `${points} approved points added for ${student.name}.`,
    row: pointRow(inserted as Record<string, unknown>, names)
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    mode?: "edit";
    id?: number;
    decision?: "approved" | "rejected";
    notes?: string;
    studentId?: string;
    activityType?: ActivityType;
    customLabel?: string | null;
    points?: number;
    minutes?: number;
    quantity?: number | null;
    status?: "pending" | "approved" | "rejected";
    submittedAt?: string;
    reason?: string;
  } | null;

  const pointId = Number(body?.id);
  if (!Number.isInteger(pointId) || pointId <= 0) {
    return NextResponse.json({ ok: false, error: "Point log ID is required." }, { status: 400 });
  }

  if (body?.mode === "edit") {
    const auth = await requireAdmin();
    if ("error" in auth) return auth.error;
    const { currentUser } = auth;

    const studentId = typeof body.studentId === "string" ? body.studentId.trim() : "";
    const activityType = body.activityType;
    const customLabel = typeof body.customLabel === "string" ? body.customLabel.trim() : "";
    const points = Number(body.points);
    const minutes = Number(body.minutes);
    const quantity = body.quantity === null || body.quantity === undefined
      ? null
      : Number(body.quantity);
    const status = body.status;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const submittedAt = parseSubmittedAt(body.submittedAt);

    if (!studentId || !activityType || !activityTypes.has(activityType)) {
      return NextResponse.json({ ok: false, error: "A valid student and activity type are required." }, { status: 400 });
    }
    if (!Number.isInteger(points) || points < 1 || points > 500) {
      return NextResponse.json({ ok: false, error: "Points must be a whole number from 1 to 500." }, { status: 400 });
    }
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 240) {
      return NextResponse.json({ ok: false, error: "Minutes must be a whole number from 0 to 240." }, { status: 400 });
    }
    if (quantity !== null && (!Number.isInteger(quantity) || quantity < 0 || quantity > 300)) {
      return NextResponse.json({ ok: false, error: "Quantity must be blank or a whole number from 0 to 300." }, { status: 400 });
    }
    if (!status || !pointStatuses.has(status)) {
      return NextResponse.json({ ok: false, error: "Status must be pending, approved, or rejected." }, { status: 400 });
    }
    if (!submittedAt) {
      return NextResponse.json({ ok: false, error: "Submission time must be a valid date after 2000 and cannot be in the future." }, { status: 400 });
    }
    if (activityType === "custom_activity" && !customLabel) {
      return NextResponse.json({ ok: false, error: "Custom activities require a label." }, { status: 400 });
    }
    if (customLabel.length > 100 || notes.length > 2000 || !reason || reason.length > 500) {
      return NextResponse.json({ ok: false, error: "Use a label under 100 characters, notes under 2,000 characters, and a required edit reason under 500 characters." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      const student = mockStudents.find((entry) => entry.id === studentId);
      const existing = mockPointLogs.find((entry) => entry.id === pointId);
      if (!student || !existing) {
        return NextResponse.json({ ok: false, error: "Point log or student not found." }, { status: 404 });
      }
      if (existing.studentId !== studentId && (existing.evidence?.length ?? 0) > 0) {
        return NextResponse.json(
          { ok: false, error: "Submissions with evidence cannot be reassigned. Create a new point log for the other member." },
          { status: 409 }
        );
      }
      return NextResponse.json({
        ok: true,
        persisted: false,
        message: `Demo: point log #${pointId} edit staged.`,
        row: {
          id: pointId,
          studentId,
          studentName: student.name,
          activityType,
          activity: activityType === "custom_activity" ? customLabel : activityLabels[activityType],
          customLabel: activityType === "custom_activity" ? customLabel : null,
          points,
          minutes,
          quantity: activityType === "id_specimens" ? quantity : null,
          status,
          submittedAt,
          notes: notes || null
        }
      });
    }

    const [{ data: before, error: loadError }, { data: student, error: studentError }] = await Promise.all([
      supabase.from("grind_points").select("*").eq("id", pointId).maybeSingle(),
      supabase.from("students").select("*").eq("id", studentId).maybeSingle()
    ]);
    if (loadError || !before) {
      return NextResponse.json({ ok: false, error: loadError?.message ?? "Point log not found." }, { status: 404 });
    }
    if (studentError) {
      return NextResponse.json({ ok: false, error: studentError.message }, { status: 500 });
    }
    if (!student) {
      return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });
    }
    if (
      String(before.student_id) !== studentId &&
      storedPointEvidenceFromMetadata(before.metadata).length > 0
    ) {
      return NextResponse.json(
        { ok: false, error: "Submissions with evidence cannot be reassigned. Create a new point log for the other member." },
        { status: 409 }
      );
    }
    if (student.is_active === false && String(before.student_id) !== studentId) {
      return NextResponse.json({ ok: false, error: "Restore this person before moving a point log to them." }, { status: 409 });
    }

    const statusChanged = String(before.status) !== status;
    const approvalFields = status === "pending"
      ? { is_approved: false, approved_at: null, approved_by: null }
      : {
          is_approved: status === "approved",
          approved_at: statusChanged ? new Date().toISOString() : before.approved_at,
          approved_by: statusChanged ? currentUser.id : before.approved_by
        };
    const update = {
      student_id: studentId,
      activity_type: activityType,
      custom_label: activityType === "custom_activity" ? customLabel : null,
      custom_category_id: activityType === "custom_activity" ? before.custom_category_id : null,
      points,
      minutes,
      quantity: activityType === "id_specimens" ? quantity : null,
      status,
      submitted_at: submittedAt,
      notes: notes || null,
      ...approvalFields
    };

    const { data: updated, error: updateError } = await supabase
      .from("grind_points")
      .update(update)
      .eq("id", pointId)
      .select("*")
      .single();
    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: "points.admin_edit",
      target: `${student.name} · point log #${pointId}`,
      reason,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      entity_table: "grind_points",
      entity_id: String(pointId),
      payload_before: before,
      payload_after: updated,
      undo_action: "points.restore_snapshot",
      is_reversible: true
    });
    if (auditError) {
      const { id: _id, ...snapshot } = before;
      const { error: rollbackError } = await supabase.from("grind_points").update(snapshot).eq("id", pointId);
      return NextResponse.json(
        {
          ok: false,
          error: rollbackError
            ? `Could not audit or roll back this edit: ${auditError.message}; ${rollbackError.message}`
            : "The edit was cancelled because its audit record could not be saved."
        },
        { status: 500 }
      );
    }

    invalidateAnalyticsCache();
    const names = new Map([[studentId, String(student.name)]]);
    return NextResponse.json({
      ok: true,
      persisted: true,
      message: `Point log #${pointId} updated. The edit can be undone from the audit log.`,
      row: pointRow(updated as Record<string, unknown>, names)
    });
  }

  if (body?.decision !== "approved" && body?.decision !== "rejected") {
    return NextResponse.json({ ok: false, error: "Decision must be approved or rejected." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before reviewing points." }, { status: 401 });
  }

  if (!roleMeets(currentUser.role, "officer")) {
    return NextResponse.json({ ok: false, error: "Officer access required." }, { status: 403 });
  }

  if (supabase) {
    const { data: before, error: loadError } = await supabase
      .from("grind_points")
      .select("*")
      .eq("id", pointId)
      .maybeSingle();
    if (loadError || !before) {
      return NextResponse.json(
        { ok: false, error: loadError?.message ?? "Point log not found." },
        { status: 404 }
      );
    }
    if (before.status !== "pending") {
      return NextResponse.json({ ok: false, error: "This point log has already been reviewed." }, { status: 409 });
    }
    const { error } = await supabase
      .from("grind_points")
      .update({
        is_approved: body.decision === "approved",
        status: body.decision,
        approved_at: new Date().toISOString(),
        approved_by: currentUser.id,
        notes: body.notes ?? null
      })
      .eq("id", pointId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: body.decision === "approved" ? "points.approve" : "points.reject",
      target: `Point log #${pointId}`,
      reason: body.notes ?? null,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      entity_table: "grind_points",
      entity_id: String(pointId),
      payload_before: before,
      payload_after: {
        status: body.decision,
        notes: body.notes ?? null
      },
      undo_action: body.decision === "approved" ? "points.unapprove" : "points.restore_pending",
      is_reversible: true
    });
    if (auditError) {
      await supabase
        .from("grind_points")
        .update({
          status: before.status,
          is_approved: before.is_approved,
          approved_at: before.approved_at,
          approved_by: before.approved_by,
          notes: before.notes
        })
        .eq("id", pointId);
      return NextResponse.json(
        { ok: false, error: "The review was rolled back because its undo record could not be saved." },
        { status: 500 }
      );
    }
    invalidateAnalyticsCache();
  }

  return NextResponse.json({
    ok: true,
    message:
      body.decision === "approved"
        ? "Point log approved. Preparation totals and readiness will update automatically."
        : "Point log rejected with audit note."
  });
}
