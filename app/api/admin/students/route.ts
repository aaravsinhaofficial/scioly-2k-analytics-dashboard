import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { getAuthenticatedStudent } from "@/lib/auth";
import { mockStudents } from "@/lib/seed";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import type { Student, UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;

const roles = new Set<UserRole>(["viewer", "officer", "admin"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

function migrationError(message: string) {
  return message.includes("is_active") || message.includes("archived_at") || message.includes("archived_by") || message.includes("admin_set_student_profile")
    ? "People archiving is not installed yet. Run the latest supabase/schema.sql, then try again."
    : message;
}

function missingAdminStorage() {
  return NextResponse.json(
    { ok: false, error: "People management is unavailable because SUPABASE_SERVICE_ROLE_KEY is missing." },
    { status: 503 }
  );
}

function normalizeEvents(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((event): event is string => typeof event === "string")
        .map((event) => event.trim().replace(/\s+/g, " "))
        .filter(Boolean)
    )
  ).slice(0, 30);
}

function personResponse(row: DbRow) {
  return {
    id: String(row.id),
    name: String(row.name ?? "Unknown person"),
    email: String(row.email ?? ""),
    grade: Number(row.grade ?? 9),
    role: (roles.has(row.role as UserRole) ? row.role : "viewer") as UserRole,
    profileEvents: normalizeEvents(row.profile_events),
    isArchived: row.is_active === false,
    accountDeleted: Boolean(row.account_deleted_at),
    archivedAt: typeof row.archived_at === "string" ? row.archived_at : null,
    hasLogin: typeof row.auth_user_id === "string" && row.auth_user_id.length > 0
  };
}

function demoPerson(student: Student) {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    grade: student.grade,
    role: student.role,
    profileEvents: student.profileEvents ?? [],
    isArchived: Boolean(student.isArchived),
    accountDeleted: false,
    archivedAt: null,
    hasLogin: true
  };
}

async function requireAdmin(errorMessage: string) {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) {
    return { response: NextResponse.json({ ok: false, error: errorMessage }, { status: 401 }) } as const;
  }
  if (currentUser.role !== "admin") {
    return { response: NextResponse.json({ ok: false, error: "Only admins can manage people." }, { status: 403 }) } as const;
  }
  return { currentUser } as const;
}

async function activeAdminCount(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>) {
  const { data, error } = await supabase.from("students").select("*").eq("role", "admin");
  if (error) return { count: 0, error };
  return {
    count: (data ?? []).filter((row) => row.is_active !== false && typeof row.auth_user_id === "string").length,
    error: null
  };
}

async function audit(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  request: Request,
  entry: {
    actorId: string;
    action: string;
    target: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    undoAction: string;
    reason: string;
  }
) {
  return supabase.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target: entry.target,
    reason: entry.reason,
    ip_address: clientIp(request),
    entity_table: "students",
    entity_id: entry.entityId,
    payload_before: entry.before ?? null,
    payload_after: entry.after ?? null,
    undo_action: entry.undoAction,
    is_reversible: true
  });
}

async function setStudentProfile(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  input: {
    id: string;
    actorId: string;
    expected: DbRow;
    name: string;
    email: string;
    grade: number | null;
    role: UserRole;
    profileEvents: string[];
    isActive: boolean;
    archivedAt: string | null;
    archivedBy: string | null;
  }
) {
  const { data, error } = await supabase.rpc("admin_set_student_profile", {
    target_student_id: input.id,
    actor_student_id: input.actorId,
    expected_profile: input.expected,
    next_name: input.name,
    next_email: input.email,
    next_grade: input.grade,
    next_role: input.role,
    next_events: input.profileEvents,
    next_is_active: input.isActive,
    next_archived_at: input.archivedAt,
    next_archived_by: input.archivedBy
  });
  const row = Array.isArray(data) ? data[0] : data;
  return { data: row as DbRow | null, error };
}

function guardedFunctionMissing(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message?.includes("admin_set_student_profile")
  ));
}

export async function GET() {
  const auth = await requireAdmin("Sign in before viewing people.");
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) return missingAdminStorage();
    return NextResponse.json({ ok: true, students: mockStudents.map(demoPerson) });
  }

  // Selecting * keeps the rest of the site usable while the archival migration
  // is pending. Missing archival columns simply map to an active profile.
  const { data, error } = await supabase.from("students").select("*").order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, students: (data ?? []).map((row) => personResponse(row as DbRow)) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    id?: string;
    name?: string;
    email?: string;
    grade?: number;
    profileEvents?: string[];
    teamId?: string;
  } | null;
  const auth = await requireAdmin("Sign in before adding or restoring people.");
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) return missingAdminStorage();
    return NextResponse.json({ ok: true, message: body?.action === "restore" ? "Static demo: person restored locally." : "Static demo: person added locally." });
  }

  if (body?.action === "restore") {
    const id = body.id?.trim();
    if (!id) return NextResponse.json({ ok: false, error: "Choose a person to restore." }, { status: 400 });

    const { data: before, error: loadError } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
    if (loadError) return NextResponse.json({ ok: false, error: migrationError(loadError.message) }, { status: 500 });
    if (!before) return NextResponse.json({ ok: false, error: "Person not found." }, { status: 404 });
    if (before.is_active !== false) return NextResponse.json({ ok: false, error: "This person is already active." }, { status: 409 });
    if (before.account_deleted_at) {
      return NextResponse.json({ ok: false, error: "Permanently deleted accounts cannot be restored." }, { status: 409 });
    }

    const beforeSnapshot = { student: before, memberships: [] as DbRow[] };
    const restoredRole: UserRole = !before.auth_user_id && before.role !== "viewer"
      ? "viewer"
      : (before.role as UserRole);
    const { data: restored, error: restoreError } = await setStudentProfile(supabase, {
      id,
      actorId: auth.currentUser.id,
      expected: before as DbRow,
      name: String(before.name),
      email: String(before.email),
      grade: before.grade === null ? null : Number(before.grade ?? 9),
      role: restoredRole,
      profileEvents: normalizeEvents(before.profile_events),
      isActive: true,
      archivedAt: null,
      archivedBy: null
    });
    if (restoreError || !restored) {
      return NextResponse.json({ ok: false, error: migrationError(restoreError?.message ?? "This person changed before restoration. Reload and try again.") }, { status: restoreError ? 500 : 409 });
    }

    const { data: archiveAudit, error: archiveAuditError } = await supabase
      .from("audit_logs")
      .select("action,payload_before,payload_after")
      .eq("entity_table", "students")
      .eq("entity_id", id)
      .in("action", ["student.archive", "student.create"])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (archiveAuditError) {
      await supabase.from("students").update({ is_active: false, archived_at: before.archived_at, archived_by: before.archived_by }).eq("id", id);
      return NextResponse.json({ ok: false, error: `Could not recover the previous team assignment: ${archiveAuditError.message}` }, { status: 500 });
    }
    const membershipSnapshot = archiveAudit?.action === "student.create"
      ? archiveAudit.payload_after
      : archiveAudit?.payload_before;
    const archivedBefore = membershipSnapshot && typeof membershipSnapshot === "object"
      ? membershipSnapshot as DbRow
      : null;
    const savedMemberships = Array.isArray(archivedBefore?.memberships)
      ? archivedBefore.memberships.filter((row): row is DbRow => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      : [];
    let restoredMemberships: DbRow[] = [];
    if (savedMemberships.length > 0) {
      const teamIds = savedMemberships.map((row) => String(row.team_id ?? "")).filter(Boolean);
      const { data: teams, error: teamError } = teamIds.length
        ? await supabase.from("teams").select("id").in("id", teamIds)
        : { data: [], error: null };
      if (teamError) {
        await supabase.from("students").update({ is_active: false, archived_at: before.archived_at, archived_by: before.archived_by }).eq("id", id);
        return NextResponse.json({ ok: false, error: `Could not validate the previous team assignment: ${teamError.message}` }, { status: 500 });
      }
      const validTeamIds = new Set((teams ?? []).map((team) => String(team.id)));
      restoredMemberships = savedMemberships
        .filter((row) => String(row.student_id) === id && validTeamIds.has(String(row.team_id)))
        .map((row) => ({ team_id: String(row.team_id), student_id: id }));
      if (restoredMemberships.length > 0) {
        const { error: membershipError } = await supabase.from("team_members").insert(restoredMemberships);
        if (membershipError) {
          await supabase.from("students").update({ is_active: false, archived_at: before.archived_at, archived_by: before.archived_by }).eq("id", id);
          return NextResponse.json({ ok: false, error: `Could not restore the previous team assignment: ${membershipError.message}` }, { status: 409 });
        }
      }
    }

    const afterSnapshot = { student: restored, memberships: restoredMemberships };
    const { error: auditError } = await audit(supabase, request, {
      actorId: auth.currentUser.id,
      action: "student.restore",
      target: String(restored.name),
      entityId: id,
      before: beforeSnapshot,
      after: afterSnapshot,
      undoAction: "student.restore",
      reason: "Admin restored a person"
    });
    if (auditError) {
      await supabase.from("team_members").delete().eq("student_id", id);
      await supabase.from("students").update({ is_active: false, archived_at: before.archived_at, archived_by: before.archived_by }).eq("id", id);
      return NextResponse.json({ ok: false, error: "The restoration was rolled back because its undo record could not be saved." }, { status: 500 });
    }

    invalidateAnalyticsCache();
    return NextResponse.json({ ok: true, student: personResponse(restored as DbRow), message: `${String(restored.name)} restored${restoredMemberships.length ? " with their previous team assignment" : ""}.` });
  }

  const name = body?.name?.trim().replace(/\s+/g, " ") ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const grade = Number(body?.grade);
  const profileEvents = normalizeEvents(body?.profileEvents);
  const teamId = body?.teamId?.trim() ?? "";
  if (name.length < 2 || name.length > 100) return NextResponse.json({ ok: false, error: "Name must be between 2 and 100 characters." }, { status: 400 });
  if (!emailPattern.test(email) || email.length > 254) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  if (!Number.isInteger(grade) || grade < 9 || grade > 12) return NextResponse.json({ ok: false, error: "Grade must be 9, 10, 11, or 12." }, { status: 400 });
  if (profileEvents.some((event) => event.length > 100)) return NextResponse.json({ ok: false, error: "Event names must be 100 characters or shorter." }, { status: 400 });

  const { data: possibleDuplicates, error: duplicateError } = await supabase.from("students").select("*");
  if (duplicateError) return NextResponse.json({ ok: false, error: duplicateError.message }, { status: 500 });
  const duplicate = (possibleDuplicates ?? []).find((row) => String(row.email).trim().toLowerCase() === email);
  if (duplicate) {
    return NextResponse.json(
      { ok: false, error: duplicate.is_active === false ? "A profile with this email is archived. Restore it from the Archived filter instead." : "A person with this email already exists." },
      { status: 409 }
    );
  }
  if (teamId) {
    const { data: team, error: teamError } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle();
    if (teamError) return NextResponse.json({ ok: false, error: teamError.message }, { status: 500 });
    if (!team) return NextResponse.json({ ok: false, error: "The selected team no longer exists." }, { status: 409 });
  }

  const { data: created, error: createError } = await supabase
    .from("students")
    .insert({ name, email, grade, role: "viewer", profile_events: profileEvents, ovr_rating: 60, total_points: 0, prev_ovr: 60 })
    .select("*")
    .single();
  if (createError || !created) {
    return NextResponse.json({ ok: false, error: createError?.code === "23505" ? "A person with this email already exists." : createError?.message ?? "Could not add this person." }, { status: createError?.code === "23505" ? 409 : 500 });
  }

  const memberships: DbRow[] = teamId ? [{ team_id: teamId, student_id: String(created.id) }] : [];
  if (memberships.length > 0) {
    const { error: membershipError } = await supabase.from("team_members").insert(memberships);
    if (membershipError) {
      await supabase.from("students").delete().eq("id", created.id);
      return NextResponse.json({ ok: false, error: `Could not assign the starting team: ${membershipError.message}` }, { status: 409 });
    }
  }

  const afterSnapshot = { student: created, memberships };
  const { error: auditError } = await audit(supabase, request, {
    actorId: auth.currentUser.id,
    action: "student.create",
    target: name,
    entityId: String(created.id),
    after: afterSnapshot,
    undoAction: "student.archive",
    reason: "Admin manually added a person"
  });
  if (auditError) {
    await supabase.from("team_members").delete().eq("student_id", created.id);
    await supabase.from("students").delete().eq("id", created.id);
    return NextResponse.json({ ok: false, error: "The new profile was cancelled because its undo record could not be saved." }, { status: 500 });
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, student: personResponse(created as DbRow), message: `${name} added${teamId ? " and assigned to a team" : ""}.` });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    email?: string;
    grade?: number;
    role?: UserRole;
    profileEvents?: string[];
  } | null;
  const auth = await requireAdmin("Sign in before editing people.");
  if ("response" in auth) return auth.response;
  const id = body?.id?.trim();
  const name = body?.name?.trim().replace(/\s+/g, " ") ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  const grade = Number(body?.grade);
  const role = body?.role;
  const profileEvents = normalizeEvents(body?.profileEvents);
  if (!id || name.length < 2 || name.length > 100 || !role || !roles.has(role)) {
    return NextResponse.json({ ok: false, error: "Person, name, and role are required." }, { status: 400 });
  }
  if (!emailPattern.test(email) || email.length > 254) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  if (!Number.isInteger(grade) || grade < 9 || grade > 12) return NextResponse.json({ ok: false, error: "Grade must be 9, 10, 11, or 12." }, { status: 400 });
  if (profileEvents.some((event) => event.length > 100)) return NextResponse.json({ ok: false, error: "Event names must be 100 characters or shorter." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) return missingAdminStorage();
    return NextResponse.json({ ok: true, message: "Static demo: profile edit staged locally." });
  }
  const { data: before, error: loadError } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "Person not found." }, { status: 404 });
  if (before.is_active === false) return NextResponse.json({ ok: false, error: "Restore this person before editing their profile." }, { status: 409 });
  if (before.auth_user_id && email !== String(before.email).trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: "This email is connected to a login and cannot be changed here." }, { status: 409 });
  }
  const { data: emailRows, error: emailLoadError } = await supabase.from("students").select("id,email");
  if (emailLoadError) return NextResponse.json({ ok: false, error: emailLoadError.message }, { status: 500 });
  if ((emailRows ?? []).some((student) => String(student.id) !== id && String(student.email).trim().toLowerCase() === email)) {
    return NextResponse.json({ ok: false, error: "Another person already uses this email address." }, { status: 409 });
  }
  if (!before.auth_user_id && role !== "viewer") return NextResponse.json({ ok: false, error: "Connect a login before granting officer or admin access." }, { status: 409 });
  if (before.role === "admin" && role !== "admin") {
    const admins = await activeAdminCount(supabase);
    if (admins.error) return NextResponse.json({ ok: false, error: admins.error.message }, { status: 500 });
    if (admins.count <= 1) return NextResponse.json({ ok: false, error: "Add another active admin before changing the last admin's role." }, { status: 409 });
  }

  const after = { name, email, grade, role, profile_events: profileEvents };
  let { data: updated, error: updateError } = await setStudentProfile(supabase, {
    id,
    actorId: auth.currentUser.id,
    expected: before as DbRow,
    name,
    email,
    grade,
    role,
    profileEvents,
    isActive: before.is_active !== false,
    archivedAt: typeof before.archived_at === "string" ? before.archived_at : null,
    archivedBy: typeof before.archived_by === "string" ? before.archived_by : null
  });
  // Profile editing existed before archival support. Keep that older deployment
  // usable until the new schema is applied; archive/restore still fail closed.
  if (guardedFunctionMissing(updateError)) {
    const fallback = await supabase.from("students").update(after).eq("id", id).select("*").maybeSingle();
    updated = fallback.data as DbRow | null;
    updateError = fallback.error;
  }
  if (updateError || !updated) return NextResponse.json({ ok: false, error: updateError?.message ?? "This person changed before saving. Reload and try again." }, { status: updateError ? 500 : 409 });
  const { error: auditError } = await audit(supabase, request, {
    actorId: auth.currentUser.id,
    action: "student.update",
    target: name,
    entityId: id,
    before,
    after: updated,
    undoAction: "student.restore",
    reason: "Admin edited a person's profile"
  });
  if (auditError) {
    await supabase.from("students").update({ name: before.name, email: before.email, grade: before.grade, role: before.role, profile_events: before.profile_events ?? [] }).eq("id", id);
    return NextResponse.json({ ok: false, error: "The profile edit was rolled back because its undo record could not be saved." }, { status: 500 });
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, student: personResponse(updated as DbRow), message: `${name} updated.` });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const auth = await requireAdmin("Sign in before removing people.");
  if ("response" in auth) return auth.response;
  const id = body?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Choose a person to remove." }, { status: 400 });
  if (id === auth.currentUser.id) return NextResponse.json({ ok: false, error: "You cannot archive your own account." }, { status: 409 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) return missingAdminStorage();
    return NextResponse.json({ ok: true, message: "Static demo: person archived locally." });
  }
  const [studentResult, membershipResult] = await Promise.all([
    supabase.from("students").select("*").eq("id", id).maybeSingle(),
    supabase.from("team_members").select("*").eq("student_id", id)
  ]);
  if (studentResult.error) return NextResponse.json({ ok: false, error: migrationError(studentResult.error.message) }, { status: 500 });
  if (membershipResult.error) return NextResponse.json({ ok: false, error: membershipResult.error.message }, { status: 500 });
  const before = studentResult.data;
  if (!before) return NextResponse.json({ ok: false, error: "Person not found." }, { status: 404 });
  if (before.is_active === false) return NextResponse.json({ ok: false, error: "This person is already archived." }, { status: 409 });
  if (before.role === "admin") {
    const admins = await activeAdminCount(supabase);
    if (admins.error) return NextResponse.json({ ok: false, error: admins.error.message }, { status: 500 });
    if (admins.count <= 1) return NextResponse.json({ ok: false, error: "Add another active admin before archiving the last admin." }, { status: 409 });
  }

  const memberships = (membershipResult.data ?? []) as DbRow[];
  const now = new Date().toISOString();
  const { data: archived, error: archiveError } = await setStudentProfile(supabase, {
    id,
    actorId: auth.currentUser.id,
    expected: before as DbRow,
    name: String(before.name),
    email: String(before.email),
    grade: before.grade === null ? null : Number(before.grade ?? 9),
    role: before.role as UserRole,
    profileEvents: normalizeEvents(before.profile_events),
    isActive: false,
    archivedAt: now,
    archivedBy: auth.currentUser.id
  });
  if (archiveError || !archived) return NextResponse.json({ ok: false, error: migrationError(archiveError?.message ?? "Could not archive this person.") }, { status: archiveError ? 500 : 409 });
  const { error: membershipDeleteError } = await supabase.from("team_members").delete().eq("student_id", id);
  if (membershipDeleteError) {
    await supabase.from("students").update({ is_active: true, archived_at: null, archived_by: null }).eq("id", id);
    return NextResponse.json({ ok: false, error: `Could not remove the active team assignment: ${membershipDeleteError.message}` }, { status: 500 });
  }

  const beforeSnapshot = { student: before, memberships };
  const afterSnapshot = { student: archived, memberships: [] };
  const { error: auditError } = await audit(supabase, request, {
    actorId: auth.currentUser.id,
    action: "student.archive",
    target: String(before.name),
    entityId: id,
    before: beforeSnapshot,
    after: afterSnapshot,
    undoAction: "student.restore",
    reason: "Admin archived a person"
  });
  if (auditError) {
    await supabase.from("students").update({ is_active: true, archived_at: null, archived_by: null }).eq("id", id);
    if (memberships.length > 0) await supabase.from("team_members").insert(memberships);
    return NextResponse.json({ ok: false, error: "The removal was rolled back because its undo record could not be saved." }, { status: 500 });
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, message: `${String(before.name)} archived. Their history is preserved and they can be restored at any time.` });
}
