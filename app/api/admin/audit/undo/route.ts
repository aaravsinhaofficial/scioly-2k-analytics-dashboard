import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { invalidateLibraryCache } from "@/lib/library-data";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const pointActivityTypes = new Set([
  "solo_study",
  "partner_study",
  "solo_practice_test",
  "partner_practice_test",
  "build_testing",
  "id_specimens",
  "custom_activity"
]);

function restorablePoint(before: Record<string, unknown>, entityId: string) {
  const id = Number(before.id);
  const points = Number(before.points);
  const minutes = Number(before.minutes ?? 0);
  const quantity = before.quantity ?? null;
  const status = before.status;
  const activityType = before.activity_type;
  const studentId = before.student_id;
  const submittedAt = before.submitted_at;
  const customLabel = before.custom_label ?? null;
  const customCategoryId = before.custom_category_id ?? null;
  const notes = before.notes ?? null;
  const metadata = before.metadata ?? {};
  const isApproved = before.is_approved === true;
  const approvedAt = before.approved_at ?? null;
  const approvedBy = before.approved_by ?? null;

  if (
    !Number.isInteger(id) || id <= 0 || String(id) !== entityId ||
    typeof studentId !== "string" || !studentId ||
    typeof activityType !== "string" || !pointActivityTypes.has(activityType) ||
    !Number.isInteger(points) || points < 1 || points > 500 ||
    !Number.isInteger(minutes) || minutes < 0 || minutes > 240 ||
    (quantity !== null && (!Number.isInteger(quantity) || Number(quantity) < 0 || Number(quantity) > 300)) ||
    typeof submittedAt !== "string" || !Number.isFinite(new Date(submittedAt).getTime()) ||
    (customLabel !== null && typeof customLabel !== "string") ||
    (customCategoryId !== null && (!Number.isInteger(customCategoryId) || Number(customCategoryId) <= 0)) ||
    (notes !== null && typeof notes !== "string") ||
    !metadata || typeof metadata !== "object" || Array.isArray(metadata) ||
    (status !== "pending" && status !== "approved" && status !== "rejected")
  ) return null;

  const validApprovalState = status === "pending"
    ? !isApproved && approvedAt === null && approvedBy === null
    : status === "approved"
      ? isApproved && typeof approvedAt === "string" && typeof approvedBy === "string"
      : !isApproved && typeof approvedAt === "string" && typeof approvedBy === "string";
  if (!validApprovalState) return null;

  return {
    id,
    student_id: studentId,
    activity_type: activityType,
    points,
    minutes,
    quantity,
    custom_label: customLabel,
    custom_category_id: customCategoryId,
    metadata,
    is_approved: isApproved,
    status,
    submitted_at: submittedAt,
    approved_at: approvedAt,
    approved_by: approvedBy,
    notes
  };
}

function samePointSnapshot(
  left: NonNullable<ReturnType<typeof restorablePoint>>,
  right: NonNullable<ReturnType<typeof restorablePoint>>
) {
  return left.id === right.id &&
    left.student_id === right.student_id &&
    left.activity_type === right.activity_type &&
    left.points === right.points &&
    left.minutes === right.minutes &&
    left.quantity === right.quantity &&
    left.custom_label === right.custom_label &&
    left.custom_category_id === right.custom_category_id &&
    left.is_approved === right.is_approved &&
    left.status === right.status &&
    left.submitted_at === right.submitted_at &&
    left.approved_at === right.approved_at &&
    left.approved_by === right.approved_by &&
    left.notes === right.notes &&
    JSON.stringify(left.metadata) === JSON.stringify(right.metadata);
}

function restorableTeam(snapshot: Record<string, unknown>, entityId: string) {
  const id = String(snapshot.id ?? "");
  const schoolName = typeof snapshot.school_name === "string" ? snapshot.school_name.trim() : "";
  const designation = typeof snapshot.team_designation === "string" ? snapshot.team_designation.trim() : "";
  const name = typeof snapshot.name === "string" && snapshot.name.trim()
    ? snapshot.name.trim()
    : `${schoolName} ${designation}`.trim();
  const teamOvr = Number(snapshot.team_ovr ?? 60);
  const version = Number(snapshot.version ?? 1);
  const createdAt = snapshot.created_at;
  if (
    id !== entityId || !name || name.length > 80 || !schoolName || schoolName.length > 120 ||
    !designation || designation.length > 20 || !Number.isFinite(teamOvr) ||
    !Number.isInteger(version) || version < 1 || (createdAt !== undefined && typeof createdAt !== "string")
  ) return null;
  return {
    id,
    name,
    school_name: schoolName,
    team_designation: designation,
    team_ovr: teamOvr,
    version,
    ...(typeof createdAt === "string" ? { created_at: createdAt } : {})
  };
}

function restorableMemberships(snapshot: Record<string, unknown>, entityId: string) {
  if (Array.isArray(snapshot.memberships)) {
    const memberships: Array<{ team_id: string; student_id: string; created_at?: string }> = [];
    for (const entry of snapshot.memberships) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const row = entry as Record<string, unknown>;
      const teamId = String(row.team_id ?? "");
      const studentId = String(row.student_id ?? "");
      if (teamId !== entityId || !studentId || (row.created_at !== undefined && typeof row.created_at !== "string")) return null;
      memberships.push({
        team_id: teamId,
        student_id: studentId,
        ...(typeof row.created_at === "string" ? { created_at: row.created_at } : {})
      });
    }
    return memberships;
  }
  if (snapshot.memberIds !== undefined && !Array.isArray(snapshot.memberIds)) return null;
  const memberIds = Array.isArray(snapshot.memberIds) ? snapshot.memberIds : [];
  if (memberIds.some((id) => typeof id !== "string" || id.length === 0)) return null;
  return memberIds.map((studentId) => ({ team_id: entityId, student_id: studentId }));
}

function restorableStudent(snapshot: Record<string, unknown>, entityId: string) {
  const id = String(snapshot.id ?? entityId);
  const name = typeof snapshot.name === "string" ? snapshot.name.trim() : "";
  const email = typeof snapshot.email === "string" ? snapshot.email.trim().toLowerCase() : null;
  const grade = snapshot.grade === null ? null : Number(snapshot.grade);
  const role = snapshot.role;
  const profileEvents = Array.isArray(snapshot.profile_events)
    ? snapshot.profile_events.filter((event): event is string => typeof event === "string")
    : [];
  if (
    id !== entityId || name.length < 2 || name.length > 100 ||
    (email !== null && (!email.includes("@") || email.length > 254)) ||
    (grade !== null && (!Number.isInteger(grade) || grade < 9 || grade > 12)) ||
    (role !== "viewer" && role !== "officer" && role !== "admin") ||
    profileEvents.some((event) => event.length > 100)
  ) return null;
  return {
    name,
    ...(email !== null ? { email } : {}),
    grade,
    role,
    profile_events: profileEvents,
    ...(typeof snapshot.is_active === "boolean" ? { is_active: snapshot.is_active } : {}),
    ...(snapshot.archived_at === null || typeof snapshot.archived_at === "string" ? { archived_at: snapshot.archived_at } : {}),
    ...(snapshot.archived_by === null || typeof snapshot.archived_by === "string" ? { archived_by: snapshot.archived_by } : {})
  };
}

function restorableStudentMemberships(snapshot: Record<string, unknown>, studentId: string) {
  if (!Array.isArray(snapshot.memberships)) return null;
  const memberships: Array<{ team_id: string; student_id: string }> = [];
  for (const value of snapshot.memberships) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const teamId = typeof row.team_id === "string" ? row.team_id : "";
    if (!teamId || String(row.student_id) !== studentId) return null;
    memberships.push({ team_id: teamId, student_id: studentId });
  }
  return memberships;
}

function sameStudentSnapshot(current: Record<string, unknown>, expected: NonNullable<ReturnType<typeof restorableStudent>>) {
  const currentEvents = Array.isArray(current.profile_events)
    ? current.profile_events.filter((event): event is string => typeof event === "string")
    : [];
  return String(current.name ?? "").trim() === expected.name &&
    (!("email" in expected) || String(current.email ?? "").trim().toLowerCase() === expected.email) &&
    (current.grade === null ? null : Number(current.grade)) === expected.grade &&
    current.role === expected.role &&
    JSON.stringify(currentEvents) === JSON.stringify(expected.profile_events) &&
    (!("is_active" in expected) || current.is_active === expected.is_active) &&
    (!("archived_at" in expected) || (current.archived_at ?? null) === expected.archived_at) &&
    (!("archived_by" in expected) || (current.archived_by ?? null) === expected.archived_by);
}

function sameStudentMemberships(current: Array<Record<string, unknown>>, expected: Array<{ team_id: string; student_id: string }>) {
  const currentIds = current.map((membership) => String(membership.team_id)).sort();
  const expectedIds = expected.map((membership) => membership.team_id).sort();
  return JSON.stringify(currentIds) === JSON.stringify(expectedIds);
}

async function setStudentProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  input: {
    id: string;
    actorId: string;
    snapshot: NonNullable<ReturnType<typeof restorableStudent>>;
    current: Record<string, unknown>;
  }
) {
  const isActive = typeof input.snapshot.is_active === "boolean"
    ? input.snapshot.is_active
    : input.current.is_active !== false;
  const archivedAt = "archived_at" in input.snapshot
    ? input.snapshot.archived_at ?? null
    : (typeof input.current.archived_at === "string" ? input.current.archived_at : null);
  const archivedBy = "archived_by" in input.snapshot
    ? input.snapshot.archived_by ?? null
    : (typeof input.current.archived_by === "string" ? input.current.archived_by : null);
  const { data, error } = await supabase.rpc("admin_set_student_profile", {
    target_student_id: input.id,
    actor_student_id: input.actorId,
    expected_profile: input.current,
    next_name: input.snapshot.name,
    next_email: "email" in input.snapshot ? input.snapshot.email : String(input.current.email),
    next_grade: input.snapshot.grade,
    next_role: input.snapshot.role,
    next_events: input.snapshot.profile_events,
    next_is_active: isActive,
    next_archived_at: archivedAt,
    next_archived_by: archivedBy
  });
  return { data: Array.isArray(data) ? data[0] : data, error };
}

function guardedFunctionMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message?.includes("admin_set_student_profile")
  ));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { auditId?: number; reason?: string } | null;
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before undoing audit actions." }, { status: 401 });
  }

  if (currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admins can undo audit actions." }, { status: 403 });
  }

  if (!body || !Number.isSafeInteger(body.auditId) || Number(body.auditId) <= 0) {
    return NextResponse.json({ ok: false, error: "Audit log ID is required." }, { status: 400 });
  }

  if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 500)) {
    return NextResponse.json({ ok: false, error: "The undo reason must be text of 500 characters or fewer." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Static demo: audit reversal staged locally." });
  }

  const { data: audit, error: auditError } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("id", body.auditId)
    .maybeSingle();

  if (auditError || !audit) {
    return NextResponse.json({ ok: false, error: auditError?.message ?? "Audit log not found." }, { status: 404 });
  }

  if (!audit.is_reversible || audit.reversed_at) {
    return NextResponse.json({ ok: false, error: "This audit entry cannot be undone." }, { status: 409 });
  }

  const entityTable = String(audit.entity_table ?? "");
  const entityId = String(audit.entity_id ?? "");
  const undoAction = String(audit.undo_action ?? "");
  const before = audit.payload_before && typeof audit.payload_before === "object" ? audit.payload_before as Record<string, unknown> : null;
  const after = audit.payload_after && typeof audit.payload_after === "object" ? audit.payload_after as Record<string, unknown> : null;
  let restoredPointId: number | null = null;
  let previousPointForUndo: NonNullable<ReturnType<typeof restorablePoint>> | null = null;
  let restoredTeamId: string | null = null;
  let deletedTeamForUndo: { team: Record<string, unknown>; memberships: Array<Record<string, unknown>> } | null = null;
  let previousTeamForUndo: Record<string, unknown> | null = null;
  let previousLibraryRow: Record<string, unknown> | null = null;
  let previousPracticeQuestion: Record<string, unknown> | null = null;
  let previousStudentForUndo: Record<string, unknown> | null = null;
  let previousStudentMembershipsForUndo: Array<Record<string, unknown>> | null = null;

  if (undoAction === "tournament.delete" && entityId) {
    const { error } = await supabase.from("tournaments").delete().eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const createdEventIds = Array.isArray(after?.createdEventIds) ? after.createdEventIds.map(Number).filter(Number.isFinite) : [];
    if (createdEventIds.length > 0) await supabase.from("events").delete().in("id", createdEventIds);
  } else if (undoAction === "points.delete" && entityId) {
    const { data: pointLog, error: loadError } = await supabase.from("grind_points").select("status").eq("id", Number(entityId)).maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
    if (!pointLog) return NextResponse.json({ ok: false, error: "This point submission no longer exists." }, { status: 409 });
    if (pointLog.status !== "pending" && audit.action !== "points.admin_create") {
      return NextResponse.json({ ok: false, error: "Undo the officer review before removing this submission." }, { status: 409 });
    }
    const { error } = await supabase.from("grind_points").delete().eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (undoAction === "points.restore" && entityTable === "grind_points" && entityId && before) {
    const restoredPoint = restorablePoint(before, entityId);
    if (!restoredPoint) {
      return NextResponse.json({ ok: false, error: "The deleted point snapshot is incomplete or invalid." }, { status: 409 });
    }
    const { data: existingPoint, error: existingError } = await supabase
      .from("grind_points")
      .select("id")
      .eq("id", restoredPoint.id)
      .maybeSingle();
    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    if (existingPoint) return NextResponse.json({ ok: false, error: "This point entry already exists." }, { status: 409 });
    const { error } = await supabase.from("grind_points").insert({
      ...restoredPoint,
      metadata: {
        ...(restoredPoint.metadata as Record<string, unknown>),
        audit_restore: true
      }
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });
    restoredPointId = restoredPoint.id;
  } else if (undoAction === "points.restore_snapshot" && entityTable === "grind_points" && entityId && before && after) {
    const restoredPoint = restorablePoint(before, entityId);
    const expectedPoint = restorablePoint(after, entityId);
    if (!restoredPoint || !expectedPoint) {
      return NextResponse.json({ ok: false, error: "The point edit snapshot is incomplete or invalid." }, { status: 409 });
    }
    const { data: current, error: loadError } = await supabase
      .from("grind_points")
      .select("*")
      .eq("id", restoredPoint.id)
      .maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ ok: false, error: "This point entry no longer exists." }, { status: 409 });
    const currentPoint = restorablePoint(current as Record<string, unknown>, entityId);
    if (!currentPoint || !samePointSnapshot(currentPoint, expectedPoint)) {
      return NextResponse.json({ ok: false, error: "This point entry was changed again. Undo its newer edit or review first." }, { status: 409 });
    }
    previousPointForUndo = currentPoint;
    const { id: _id, ...snapshot } = restoredPoint;
    const { error } = await supabase.from("grind_points").update(snapshot).eq("id", restoredPoint.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if ((undoAction === "points.unapprove" || undoAction === "points.restore_pending") && entityTable === "grind_points" && entityId && before && after) {
    const restoredPoint = restorablePoint(before, entityId);
    if (!restoredPoint) return NextResponse.json({ ok: false, error: "The review snapshot is incomplete or invalid." }, { status: 409 });
    const [pointResult, newerResult] = await Promise.all([
      supabase.from("grind_points").select("*").eq("id", restoredPoint.id).maybeSingle(),
      supabase.from("audit_logs").select("id").eq("entity_table", "grind_points")
        .eq("entity_id", entityId).gt("id", audit.id).eq("is_reversible", true).is("reversed_at", null).limit(1)
    ]);
    if (pointResult.error || newerResult.error) {
      return NextResponse.json({ ok: false, error: pointResult.error?.message ?? newerResult.error?.message }, { status: 500 });
    }
    const current = pointResult.data;
    const currentPoint = current ? restorablePoint(current as Record<string, unknown>, entityId) : null;
    // Old review audits stored only status and notes; newer audits retain the complete row.
    const expectedPoint = after.id ? restorablePoint(after, entityId) : null;
    if (!currentPoint || (newerResult.data ?? []).length > 0 ||
        (expectedPoint ? !samePointSnapshot(currentPoint, expectedPoint) :
          currentPoint.status !== after.status || currentPoint.notes !== (after.notes ?? null))) {
      return NextResponse.json({ ok: false, error: "This point entry changed after this review. Undo its newer edit or review first." }, { status: 409 });
    }
    let restoreReview = supabase
      .from("grind_points")
      .update({
        status: restoredPoint.status,
        is_approved: restoredPoint.is_approved,
        approved_at: restoredPoint.approved_at,
        approved_by: restoredPoint.approved_by,
        notes: restoredPoint.notes
      })
      .eq("id", restoredPoint.id)
      .eq("status", currentPoint.status)
      .eq("is_approved", currentPoint.is_approved)
      .eq("approved_at", currentPoint.approved_at)
      .eq("approved_by", currentPoint.approved_by);
    restoreReview = currentPoint.notes === null
      ? restoreReview.is("notes", null)
      : restoreReview.eq("notes", currentPoint.notes);
    const { data: restored, error } = await restoreReview.select("id").maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!restored) return NextResponse.json({ ok: false, error: "This point entry changed before the undo was applied. Reload and try again." }, { status: 409 });
    previousPointForUndo = currentPoint;
  } else if (undoAction === "student.archive" && entityTable === "students" && entityId) {
    const [studentResult, membershipResult] = await Promise.all([
      supabase.from("students").select("*").eq("id", entityId).maybeSingle(),
      supabase.from("team_members").select("*").eq("student_id", entityId)
    ]);
    if (studentResult.error || membershipResult.error) {
      return NextResponse.json({ ok: false, error: studentResult.error?.message ?? membershipResult.error?.message }, { status: 500 });
    }
    if (!studentResult.data) return NextResponse.json({ ok: false, error: "This person no longer exists." }, { status: 409 });
    if (studentResult.data.is_active === false) return NextResponse.json({ ok: false, error: "This person is already archived." }, { status: 409 });
    if (entityId === currentUser.id) return NextResponse.json({ ok: false, error: "You cannot archive your own account." }, { status: 409 });
    if (after?.student && typeof after.student === "object" && !Array.isArray(after.student)) {
      const expectedStudent = restorableStudent(after.student as Record<string, unknown>, entityId);
      const expectedMemberships = restorableStudentMemberships(after, entityId);
      if (!expectedStudent || !expectedMemberships) {
        return NextResponse.json({ ok: false, error: "The original profile snapshot is incomplete or invalid." }, { status: 409 });
      }
      if (!sameStudentSnapshot(studentResult.data as Record<string, unknown>, expectedStudent) ||
          !sameStudentMemberships((membershipResult.data ?? []) as Array<Record<string, unknown>>, expectedMemberships)) {
        return NextResponse.json({ ok: false, error: "This person changed after they were added. Undo the newer profile or roster change first." }, { status: 409 });
      }
    }
    previousStudentForUndo = studentResult.data as Record<string, unknown>;
    previousStudentMembershipsForUndo = (membershipResult.data ?? []) as Array<Record<string, unknown>>;
    const archiveSnapshot = restorableStudent({
      ...studentResult.data,
      is_active: false,
      archived_at: new Date().toISOString(),
      archived_by: currentUser.id
    }, entityId);
    if (!archiveSnapshot) return NextResponse.json({ ok: false, error: "The current profile is invalid." }, { status: 409 });
    const { error: updateError } = await setStudentProfile(supabase, {
      id: entityId,
      actorId: currentUser.id,
      snapshot: archiveSnapshot,
      current: studentResult.data as Record<string, unknown>
    });
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    const { error: deleteError } = await supabase.from("team_members").delete().eq("student_id", entityId);
    if (deleteError) {
      const { id: _id, ...studentSnapshot } = previousStudentForUndo;
      await supabase.from("students").update(studentSnapshot).eq("id", entityId);
      return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }
  } else if (undoAction === "student.restore" && entityTable === "students" && entityId && before) {
    const rawStudent = before.student && typeof before.student === "object" && !Array.isArray(before.student)
      ? before.student as Record<string, unknown>
      : before;
    const restoredStudent = restorableStudent(rawStudent, entityId);
    const shouldRestoreMemberships = rawStudent !== before;
    const desiredMemberships = shouldRestoreMemberships ? restorableStudentMemberships(before, entityId) : null;
    if (!restoredStudent || (shouldRestoreMemberships && !desiredMemberships)) {
      return NextResponse.json({ ok: false, error: "The person snapshot is incomplete or invalid." }, { status: 409 });
    }
    const [studentResult, membershipResult] = await Promise.all([
      supabase.from("students").select("*").eq("id", entityId).maybeSingle(),
      supabase.from("team_members").select("*").eq("student_id", entityId)
    ]);
    if (studentResult.error || membershipResult.error) {
      return NextResponse.json({ ok: false, error: studentResult.error?.message ?? membershipResult.error?.message }, { status: 500 });
    }
    if (!studentResult.data) return NextResponse.json({ ok: false, error: "This person no longer exists." }, { status: 409 });
    if (!studentResult.data.auth_user_id && restoredStudent.role !== "viewer") {
      restoredStudent.role = "viewer";
    }
    if (after) {
      const rawExpectedStudent = after.student && typeof after.student === "object" && !Array.isArray(after.student)
        ? after.student as Record<string, unknown>
        : after;
      const expectedStudent = restorableStudent(rawExpectedStudent, entityId);
      const expectsMemberships = rawExpectedStudent !== after;
      const expectedMemberships = expectsMemberships ? restorableStudentMemberships(after, entityId) : null;
      if (!expectedStudent || (expectsMemberships && !expectedMemberships)) {
        return NextResponse.json({ ok: false, error: "The expected profile snapshot is incomplete or invalid." }, { status: 409 });
      }
      if (!sameStudentSnapshot(studentResult.data as Record<string, unknown>, expectedStudent) ||
          (expectedMemberships && !sameStudentMemberships((membershipResult.data ?? []) as Array<Record<string, unknown>>, expectedMemberships))) {
        return NextResponse.json({ ok: false, error: "This person changed again. Undo the newer profile or roster change first." }, { status: 409 });
      }
    }
    if (entityId === currentUser.id && restoredStudent.is_active === false) {
      return NextResponse.json({ ok: false, error: "You cannot archive your own account." }, { status: 409 });
    }
    const removesAdminAccess = studentResult.data.role === "admin" && studentResult.data.is_active !== false &&
      (restoredStudent.role !== "admin" || restoredStudent.is_active === false);
    if (removesAdminAccess) {
      const { data: admins, error: adminError } = await supabase.from("students").select("*").eq("role", "admin");
      if (adminError) return NextResponse.json({ ok: false, error: adminError.message }, { status: 500 });
      if ((admins ?? []).filter((student) => student.is_active !== false).length <= 1) {
        return NextResponse.json({ ok: false, error: "Add another active admin before reversing this change." }, { status: 409 });
      }
    }
    previousStudentForUndo = studentResult.data as Record<string, unknown>;
    previousStudentMembershipsForUndo = (membershipResult.data ?? []) as Array<Record<string, unknown>>;
    let { error: updateError } = await setStudentProfile(supabase, {
      id: entityId,
      actorId: currentUser.id,
      snapshot: restoredStudent,
      current: studentResult.data as Record<string, unknown>
    });
    if (guardedFunctionMissing(updateError) && !("is_active" in restoredStudent)) {
      const fallback = await supabase.from("students").update(restoredStudent).eq("id", entityId);
      updateError = fallback.error;
    }
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

    if (shouldRestoreMemberships) {
      const { error: deleteError } = await supabase.from("team_members").delete().eq("student_id", entityId);
      if (deleteError) {
        const { id: _id, ...studentSnapshot } = previousStudentForUndo;
        await supabase.from("students").update(studentSnapshot).eq("id", entityId);
        return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
      }
      if (desiredMemberships && desiredMemberships.length > 0) {
        const teamIds = desiredMemberships.map((membership) => membership.team_id);
        const { data: existingTeams, error: teamError } = await supabase.from("teams").select("id").in("id", teamIds);
        if (teamError) {
          const { id: _id, ...studentSnapshot } = previousStudentForUndo;
          await supabase.from("students").update(studentSnapshot).eq("id", entityId);
          if (previousStudentMembershipsForUndo.length > 0) await supabase.from("team_members").insert(previousStudentMembershipsForUndo);
          return NextResponse.json({ ok: false, error: teamError.message }, { status: 500 });
        }
        const validTeamIds = new Set((existingTeams ?? []).map((team) => String(team.id)));
        const validMemberships = desiredMemberships.filter((membership) => validTeamIds.has(membership.team_id));
        if (validMemberships.length > 0) {
          const { error: insertError } = await supabase.from("team_members").insert(validMemberships);
          if (insertError) {
            const { id: _id, ...studentSnapshot } = previousStudentForUndo;
            await supabase.from("students").update(studentSnapshot).eq("id", entityId);
            if (previousStudentMembershipsForUndo.length > 0) await supabase.from("team_members").insert(previousStudentMembershipsForUndo);
            return NextResponse.json({ ok: false, error: insertError.message }, { status: 409 });
          }
        }
      }
    }
  } else if ((undoAction === "category.restore" || undoAction === "category.deactivate") && entityId) {
    const update = before
      ? { name: before.name, default_points: before.default_points, max_points: before.max_points, is_active: before.is_active }
      : { is_active: false };
    const { error } = await supabase.from("custom_point_categories").update(update).eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (undoAction === "roster.restore" && before && Array.isArray(before.groups)) {
    const { error } = await supabase.rpc("replace_team_memberships", { roster_groups: before.groups });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (undoAction === "team.restore" && entityTable === "teams" && entityId && before) {
    const rawTeam = before.team && typeof before.team === "object" && !Array.isArray(before.team)
      ? before.team as Record<string, unknown>
      : null;
    const team = rawTeam ? restorableTeam(rawTeam, entityId) : null;
    const memberships = restorableMemberships(before, entityId);
    if (!team || !memberships) {
      return NextResponse.json({ ok: false, error: "The deleted team snapshot is incomplete or invalid." }, { status: 409 });
    }
    const { data: existingTeam, error: existingTeamError } = await supabase.from("teams").select("id").eq("id", entityId).maybeSingle();
    if (existingTeamError) return NextResponse.json({ ok: false, error: existingTeamError.message }, { status: 500 });
    if (existingTeam) return NextResponse.json({ ok: false, error: "This team already exists." }, { status: 409 });
    if (memberships.length > 0) {
      const memberIds = memberships.map((membership) => String(membership.student_id));
      const { data: currentMemberships, error: membershipCheckError } = await supabase
        .from("team_members")
        .select("student_id")
        .in("student_id", memberIds);
      if (membershipCheckError) return NextResponse.json({ ok: false, error: membershipCheckError.message }, { status: 500 });
      if ((currentMemberships ?? []).length > 0) {
        return NextResponse.json({ ok: false, error: "One or more former members now belong to another team. Undo those newer roster changes first." }, { status: 409 });
      }
    }
    const { error: teamError } = await supabase.from("teams").insert(team);
    if (teamError) return NextResponse.json({ ok: false, error: teamError.message }, { status: 409 });
    if (memberships.length > 0) {
      const { error: memberError } = await supabase.from("team_members").insert(memberships);
      if (memberError) {
        await supabase.from("teams").delete().eq("id", entityId);
        return NextResponse.json({ ok: false, error: memberError.message }, { status: 409 });
      }
    }
    restoredTeamId = entityId;
  } else if (undoAction === "team.delete" && entityTable === "teams" && entityId && after) {
    const expectedRawTeam = after.team && typeof after.team === "object" && !Array.isArray(after.team)
      ? after.team as Record<string, unknown>
      : null;
    const expectedTeam = expectedRawTeam ? restorableTeam(expectedRawTeam, entityId) : null;
    if (!expectedTeam) return NextResponse.json({ ok: false, error: "The created team snapshot is incomplete or invalid." }, { status: 409 });
    const [currentTeamResult, currentMembershipResult] = await Promise.all([
      supabase.from("teams").select("*").eq("id", entityId).maybeSingle(),
      supabase.from("team_members").select("*").eq("team_id", entityId)
    ]);
    if (currentTeamResult.error) return NextResponse.json({ ok: false, error: currentTeamResult.error.message }, { status: 500 });
    if (currentMembershipResult.error) return NextResponse.json({ ok: false, error: currentMembershipResult.error.message }, { status: 500 });
    if (!currentTeamResult.data) return NextResponse.json({ ok: false, error: "This team no longer exists." }, { status: 409 });
    if (Number(currentTeamResult.data.version) !== expectedTeam.version || (currentMembershipResult.data ?? []).length > 0) {
      return NextResponse.json({ ok: false, error: "This team has changed since it was created. Undo its newer edits or roster assignments first." }, { status: 409 });
    }
    deletedTeamForUndo = {
      team: currentTeamResult.data as Record<string, unknown>,
      memberships: (currentMembershipResult.data ?? []) as Array<Record<string, unknown>>
    };
    const { error } = await supabase.from("teams").delete().eq("id", entityId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (undoAction === "team.restore_snapshot" && entityTable === "teams" && entityId && before) {
    const beforeRawTeam = before.team && typeof before.team === "object" && !Array.isArray(before.team)
      ? before.team as Record<string, unknown>
      : null;
    const restoredTeam = beforeRawTeam ? restorableTeam(beforeRawTeam, entityId) : null;
    const afterRawTeam = after?.team && typeof after.team === "object" && !Array.isArray(after.team)
      ? after.team as Record<string, unknown>
      : null;
    const expectedCurrentTeam = afterRawTeam ? restorableTeam(afterRawTeam, entityId) : null;
    if (!restoredTeam || !expectedCurrentTeam) return NextResponse.json({ ok: false, error: "The team edit snapshot is incomplete or invalid." }, { status: 409 });
    const { data: currentTeam, error: currentTeamError } = await supabase.from("teams").select("*").eq("id", entityId).maybeSingle();
    if (currentTeamError) return NextResponse.json({ ok: false, error: currentTeamError.message }, { status: 500 });
    if (!currentTeam) return NextResponse.json({ ok: false, error: "This team no longer exists." }, { status: 409 });
    if (Number(currentTeam.version) !== expectedCurrentTeam.version) {
      return NextResponse.json({ ok: false, error: "This team was edited again. Undo the newer team edit first." }, { status: 409 });
    }
    previousTeamForUndo = currentTeam as Record<string, unknown>;
    const { data: restored, error } = await supabase.from("teams").update({
      name: restoredTeam.name,
      school_name: restoredTeam.school_name,
      team_designation: restoredTeam.team_designation,
      version: restoredTeam.version
    }).eq("id", entityId).eq("version", expectedCurrentTeam.version).select("id").maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "23505" ? 409 : 500 });
    if (!restored) return NextResponse.json({ ok: false, error: "This team changed before the undo could be applied. Reload the audit log and try again." }, { status: 409 });
  } else if (undoAction === "practice_question.remove" && entityTable === "practice_test_questions" && entityId) {
    const questionId = Number(entityId);
    if (!Number.isInteger(questionId) || questionId <= 0) return NextResponse.json({ ok: false, error: "The practice question ID is invalid." }, { status: 409 });
    const { data: current, error: loadError } = await supabase.from("practice_test_questions").select("*").eq("id", questionId).maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ ok: false, error: "This practice question no longer exists." }, { status: 409 });
    if (after && String(current.updated_at ?? "") !== String(after.updated_at ?? "")) {
      return NextResponse.json({ ok: false, error: "This question changed again. Undo its newer edit first." }, { status: 409 });
    }
    previousPracticeQuestion = current as Record<string, unknown>;
    const { data: removed, error } = await supabase
      .from("practice_test_questions")
      .update({ is_active: false, updated_by: currentUser.id, updated_at: new Date().toISOString() })
      .eq("id", questionId)
      .eq("updated_at", String(current.updated_at))
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!removed) return NextResponse.json({ ok: false, error: "This question changed before the undo could be applied. Reload the audit log and try again." }, { status: 409 });
  } else if (undoAction === "practice_question.restore" && entityTable === "practice_test_questions" && entityId && before) {
    const questionId = Number(entityId);
    if (!Number.isInteger(questionId) || questionId <= 0 || Number(before.id) !== questionId) return NextResponse.json({ ok: false, error: "The practice question snapshot is invalid." }, { status: 409 });
    const { data: current, error: loadError } = await supabase.from("practice_test_questions").select("*").eq("id", questionId).maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ ok: false, error: "This practice question no longer exists." }, { status: 409 });
    if (after && String(current.updated_at ?? "") !== String(after.updated_at ?? "")) {
      return NextResponse.json({ ok: false, error: "This question changed again. Undo its newer edit first." }, { status: 409 });
    }
    previousPracticeQuestion = current as Record<string, unknown>;
    const { id: _id, ...snapshot } = before;
    const { data: restored, error } = await supabase
      .from("practice_test_questions")
      .update(snapshot)
      .eq("id", questionId)
      .eq("updated_at", String(current.updated_at))
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!restored) return NextResponse.json({ ok: false, error: "This question changed before the undo could be applied. Reload the audit log and try again." }, { status: 409 });
  } else if (undoAction === "library.remove" && entityTable === "library_items" && entityId) {
    const libraryId = Number(entityId);
    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return NextResponse.json({ ok: false, error: "The library item ID is invalid." }, { status: 409 });
    }
    const { data: current, error: loadError } = await supabase.from("library_items").select("*").eq("id", libraryId).maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ ok: false, error: "This library item no longer exists." }, { status: 409 });
    if (after && String(current.updated_at ?? "") !== String(after.updated_at ?? "")) {
      return NextResponse.json({ ok: false, error: "This library item changed again. Undo its newer edit first." }, { status: 409 });
    }
    previousLibraryRow = current as Record<string, unknown>;
    const { data: removed, error } = await supabase
      .from("library_items")
      .update({ is_active: false, updated_by: currentUser.id, updated_at: new Date().toISOString() })
      .eq("id", libraryId)
      .eq("updated_at", String(current.updated_at))
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!removed) return NextResponse.json({ ok: false, error: "This library item changed before the undo could be applied. Reload the audit log and try again." }, { status: 409 });
  } else if (undoAction === "library.restore" && entityTable === "library_items" && entityId && before) {
    const libraryId = Number(entityId);
    if (!Number.isInteger(libraryId) || libraryId <= 0 || Number(before.id) !== libraryId) {
      return NextResponse.json({ ok: false, error: "The library item snapshot is invalid." }, { status: 409 });
    }
    const { data: current, error: loadError } = await supabase.from("library_items").select("*").eq("id", libraryId).maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ ok: false, error: "This library item no longer exists." }, { status: 409 });
    if (after && String(current.updated_at ?? "") !== String(after.updated_at ?? "")) {
      return NextResponse.json({ ok: false, error: "This library item changed again. Undo its newer edit first." }, { status: 409 });
    }
    previousLibraryRow = current as Record<string, unknown>;
    const { id: _id, ...snapshot } = before;
    const { data: restored, error } = await supabase
      .from("library_items")
      .update(snapshot)
      .eq("id", libraryId)
      .eq("updated_at", String(current.updated_at))
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!restored) return NextResponse.json({ ok: false, error: "This library item changed before the undo could be applied. Reload the audit log and try again." }, { status: 409 });
  } else if (undoAction === "testoff.delete" && entityId) {
    const { error } = await supabase.from("testoff_sessions").delete().eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (undoAction === "testoff.restore" && before) {
    const session = before.session && typeof before.session === "object" ? before.session as Record<string, unknown> : null;
    const results = Array.isArray(before.results) ? before.results as Array<Record<string, unknown>> : [];
    if (!session) return NextResponse.json({ ok: false, error: "The deleted testoff snapshot is incomplete." }, { status: 409 });
    const { error: sessionError } = await supabase.from("testoff_sessions").insert(session);
    if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 409 });
    if (results.length > 0) {
      const restoredResults = results.map((result) => ({
        id: result.id,
        session_id: result.session_id,
        student_id: result.student_id,
        raw_score: result.raw_score,
        rank: result.rank,
        notes: result.notes ?? null,
        entered_by: result.entered_by ?? currentUser.id,
        created_at: result.created_at
      }));
      const { error: resultError } = await supabase.from("testoff_results").insert(restoredResults);
      if (resultError) {
        await supabase.from("testoff_sessions").delete().eq("id", Number(session.id));
        return NextResponse.json({ ok: false, error: resultError.message }, { status: 409 });
      }
    }
  } else {
    return NextResponse.json({ ok: false, error: `Undo is not implemented for ${undoAction || entityTable || "this action"}.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error: markError } = await supabase
    .from("audit_logs")
    .update({
      reversed_at: now,
      reversed_by: currentUser.id
    })
    .eq("id", body.auditId);

  if (markError) {
    if (restoredPointId !== null) {
      await supabase.from("grind_points").delete().eq("id", restoredPointId);
    }
    if (previousPointForUndo) {
      const { id, ...snapshot } = previousPointForUndo;
      await supabase.from("grind_points").update(snapshot).eq("id", id);
    }
    if (restoredTeamId !== null) {
      await supabase.from("teams").delete().eq("id", restoredTeamId);
    }
    if (deletedTeamForUndo) {
      await supabase.from("teams").insert(deletedTeamForUndo.team);
      if (deletedTeamForUndo.memberships.length > 0) {
        await supabase.from("team_members").insert(deletedTeamForUndo.memberships);
      }
    }
    if (previousTeamForUndo) {
      await supabase.from("teams").update({
        name: previousTeamForUndo.name,
        school_name: previousTeamForUndo.school_name,
        team_designation: previousTeamForUndo.team_designation,
        version: previousTeamForUndo.version
      }).eq("id", entityId);
    }
    if (previousLibraryRow) {
      const { id, ...snapshot } = previousLibraryRow;
      await supabase.from("library_items").update(snapshot).eq("id", Number(id));
    }
    if (previousPracticeQuestion) {
      const { id, ...snapshot } = previousPracticeQuestion;
      await supabase.from("practice_test_questions").update(snapshot).eq("id", Number(id));
    }
    if (previousStudentForUndo) {
      const { id, ...snapshot } = previousStudentForUndo;
      await supabase.from("students").update(snapshot).eq("id", String(id));
      if (previousStudentMembershipsForUndo) {
        await supabase.from("team_members").delete().eq("student_id", String(id));
        if (previousStudentMembershipsForUndo.length > 0) {
          await supabase.from("team_members").insert(previousStudentMembershipsForUndo);
        }
      }
    }
    return NextResponse.json({ ok: false, error: markError.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "audit.undo",
    target: audit.target,
    reason: body.reason ?? "Admin undo",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: entityTable || null,
    entity_id: entityId || null,
    payload_before: audit.payload_after,
    payload_after: audit.payload_before,
    undo_action: null,
    is_reversible: false,
    reversal_of: body.auditId
  });

  invalidateAnalyticsCache();
  if (entityTable === "library_items") invalidateLibraryCache();
  return NextResponse.json({ ok: true, message: `Reversed audit #${body.auditId}.` });
}
