import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { getAuthenticatedStudent } from "@/lib/auth";
import { mockTeams } from "@/lib/seed";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface RosterGroupInput {
  teamId?: string;
  memberIds?: string[];
}

interface TeamInput {
  teamId?: string;
  name?: string;
  schoolName?: string;
  designation?: string;
  confirmation?: string;
}

function normalizeTeamFields(body: TeamInput | null) {
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const schoolName = typeof body?.schoolName === "string" ? body.schoolName.trim().replace(/\s+/g, " ") : "";
  const designation = typeof body?.designation === "string" ? body.designation.trim().replace(/\s+/g, " ").toUpperCase() : "";

  if (name.length < 2 || name.length > 80) return { error: "Team name must be between 2 and 80 characters." } as const;
  if (schoolName.length < 2 || schoolName.length > 120) return { error: "School name must be between 2 and 120 characters." } as const;
  if (designation.length < 1 || designation.length > 20) return { error: "Designation must be between 1 and 20 characters." } as const;
  return { name, schoolName, designation } as const;
}

function teamResponse(team: Record<string, unknown>) {
  return {
    id: String(team.id),
    name: String(team.name),
    schoolName: String(team.school_name),
    designation: String(team.team_designation),
    version: Number(team.version ?? 1)
  };
}

function membershipSnapshot(rows: Array<Record<string, unknown>>) {
  return {
    memberships: rows,
    memberIds: rows.map((membership) => String(membership.student_id))
  };
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as TeamInput | null;
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in before adding a team." }, { status: 401 });
  if (currentUser.role !== "admin") return NextResponse.json({ ok: false, error: "Only admins can add teams." }, { status: 403 });

  const fields = normalizeTeamFields(body);
  if ("error" in fields) return NextResponse.json({ ok: false, error: fields.error }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const duplicate = mockTeams.some((team) => team.schoolName.toLowerCase() === fields.schoolName.toLowerCase() && team.teamDesignation.toLowerCase() === fields.designation.toLowerCase());
    if (duplicate) return NextResponse.json({ ok: false, error: "That school already has a team with this designation." }, { status: 409 });
    return NextResponse.json({
      ok: true,
      persisted: false,
      team: { id: crypto.randomUUID(), ...fields, version: 1 },
      message: `${fields.name} added for this demo view.`
    });
  }

  const { data: team, error: createError } = await supabase
    .from("teams")
    .insert({ name: fields.name, school_name: fields.schoolName, team_designation: fields.designation })
    .select("*")
    .single();
  if (createError || !team) {
    return NextResponse.json(
      { ok: false, error: createError?.code === "23505" ? "That school already has a team with this designation." : createError?.message ?? "Could not create the team." },
      { status: createError?.code === "23505" ? 409 : 500 }
    );
  }

  const snapshot = { team, ...membershipSnapshot([]) };
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "team.create",
    target: fields.name,
    reason: "Admin added a team",
    ip_address: clientIp(request),
    entity_table: "teams",
    entity_id: String(team.id),
    payload_after: snapshot,
    undo_action: "team.delete",
    is_reversible: true
  });
  if (auditError) {
    const { error: rollbackError } = await supabase.from("teams").delete().eq("id", team.id);
    return NextResponse.json(
      { ok: false, error: rollbackError ? `Could not audit or roll back team creation: ${auditError.message}; ${rollbackError.message}` : "The new team was cancelled because its audit record could not be saved." },
      { status: 500 }
    );
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, persisted: true, team: teamResponse(team), message: `${fields.name} added.` });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as TeamInput | null;
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in before editing a team." }, { status: 401 });
  if (currentUser.role !== "admin") return NextResponse.json({ ok: false, error: "Only admins can edit teams." }, { status: 403 });
  const teamId = (typeof body?.teamId === "string" ? body.teamId.trim() : "");
  if (!teamId || teamId === "unassigned") return NextResponse.json({ ok: false, error: "A valid team is required." }, { status: 400 });
  const fields = normalizeTeamFields(body);
  if ("error" in fields) return NextResponse.json({ ok: false, error: fields.error }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, persisted: false, team: { id: teamId, ...fields, version: 1 }, message: `${fields.name} updated for this demo view.` });
  }

  const [teamResult, memberResult] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase.from("team_members").select("*").eq("team_id", teamId)
  ]);
  if (teamResult.error) return NextResponse.json({ ok: false, error: teamResult.error.message }, { status: 500 });
  if (memberResult.error) return NextResponse.json({ ok: false, error: memberResult.error.message }, { status: 500 });
  const beforeTeam = teamResult.data;
  if (!beforeTeam) return NextResponse.json({ ok: false, error: "Team not found." }, { status: 404 });
  const beforeSnapshot = { team: beforeTeam, ...membershipSnapshot((memberResult.data ?? []) as Array<Record<string, unknown>>) };

  const nextVersion = Number(beforeTeam.version ?? 1) + 1;
  const { data: updatedTeam, error: updateError } = await supabase
    .from("teams")
    .update({ name: fields.name, school_name: fields.schoolName, team_designation: fields.designation, version: nextVersion })
    .eq("id", teamId)
    .eq("version", beforeTeam.version)
    .select("*")
    .maybeSingle();
  if (updateError || !updatedTeam) {
    return NextResponse.json(
      { ok: false, error: updateError?.code === "23505" ? "That school already has a team with this designation." : updateError?.message ?? "This team changed in another session. Reload and try again." },
      { status: updateError ? (updateError.code === "23505" ? 409 : 500) : 409 }
    );
  }

  const afterSnapshot = { team: updatedTeam, ...membershipSnapshot((memberResult.data ?? []) as Array<Record<string, unknown>>) };
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "team.update",
    target: fields.name,
    reason: "Admin edited team details",
    ip_address: clientIp(request),
    entity_table: "teams",
    entity_id: teamId,
    payload_before: beforeSnapshot,
    payload_after: afterSnapshot,
    undo_action: "team.restore_snapshot",
    is_reversible: true
  });
  if (auditError) {
    const rollbackResult = await supabase.from("teams").update({
      name: beforeTeam.name,
      school_name: beforeTeam.school_name,
      team_designation: beforeTeam.team_designation,
      version: beforeTeam.version
    }).eq("id", teamId).eq("version", nextVersion).select("id").maybeSingle();
    const rollbackMessage = rollbackResult.error?.message ?? (!rollbackResult.data ? "the team changed again before rollback" : null);
    return NextResponse.json(
      { ok: false, error: rollbackMessage ? `Could not audit or roll back the team edit: ${auditError.message}; ${rollbackMessage}` : "The team edit was cancelled because its audit record could not be saved." },
      { status: 500 }
    );
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, persisted: true, team: teamResponse(updatedTeam), message: `${fields.name} updated.` });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { groups?: RosterGroupInput[] } | null;
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before editing rosters." }, { status: 401 });
  }
  if (currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admins can edit rosters." }, { status: 403 });
  }
  if (!Array.isArray(body?.groups) || body.groups.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one roster group is required." }, { status: 400 });
  }

  if (body.groups.some((group) => !group || typeof group !== "object" || Array.isArray(group) ||
      !Array.isArray(group.memberIds) || group.memberIds.some((id) => typeof id !== "string" || !id.trim()))) {
    return NextResponse.json({ ok: false, error: "Every roster group needs a valid member list." }, { status: 400 });
  }
  const groups = body.groups.map((group) => ({
    teamId: typeof group.teamId === "string" ? group.teamId : "",
    memberIds: Array.isArray(group.memberIds)
      ? group.memberIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  }));
  if (new Set(groups.map((group) => group.teamId)).size !== groups.length) {
    return NextResponse.json({ ok: false, error: "Each team can appear only once in a roster save." }, { status: 400 });
  }
  const seenStudents = new Set<string>();
  for (const group of groups) {
    if (!group.teamId) {
      return NextResponse.json({ ok: false, error: "Every roster group needs an ID." }, { status: 400 });
    }
    for (const studentId of group.memberIds) {
      if (seenStudents.has(studentId)) {
        return NextResponse.json(
          { ok: false, error: "A student cannot be assigned to more than one team." },
          { status: 400 }
        );
      }
      seenStudents.add(studentId);
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Demo roster updated for this browser session." });
  }

  const [teamResult, membershipResult] = await Promise.all([
    supabase.from("teams").select("id"),
    supabase.from("team_members").select("team_id,student_id")
  ]);
  if (teamResult.error || membershipResult.error) {
    return NextResponse.json({ ok: false, error: teamResult.error?.message ?? membershipResult.error?.message }, { status: 500 });
  }
  const beforeGroups = (teamResult.data ?? []).map((team) => ({
    teamId: String(team.id),
    memberIds: (membershipResult.data ?? [])
      .filter((membership) => String(membership.team_id) === String(team.id))
      .map((membership) => String(membership.student_id))
  }));

  const { error: rosterError } = await supabase.rpc("replace_team_memberships", {
    roster_groups: groups
  });
  if (rosterError) {
    return NextResponse.json({ ok: false, error: rosterError.message }, { status: 409 });
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "roster.replace",
    target: "Team rosters",
    reason: "Admin roster editor save",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "team_members",
    entity_id: "all",
    payload_before: { groups: beforeGroups },
    payload_after: { groups },
    undo_action: "roster.restore",
    is_reversible: true
  });
  if (auditError) {
    const { error: rollbackError } = await supabase.rpc("replace_team_memberships", {
      roster_groups: beforeGroups
    });
    return NextResponse.json(
      {
        ok: false,
        error: rollbackError
          ? `Could not audit or roll back the roster change: ${auditError.message}; ${rollbackError.message}`
          : "The roster change was cancelled because its audit record could not be saved."
      },
      { status: 500 }
    );
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, message: "Team rosters saved." });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as TeamInput | null;
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in before removing a team." }, { status: 401 });
  if (currentUser.role !== "admin") return NextResponse.json({ ok: false, error: "Only admins can remove teams." }, { status: 403 });
  const teamId = (typeof body?.teamId === "string" ? body.teamId.trim() : "");
  if (!teamId || teamId === "unassigned") return NextResponse.json({ ok: false, error: "A valid team is required." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const team = mockTeams.find((entry) => entry.id === teamId);
    const expectedName = team?.name || (team ? `${team.schoolName} ${team.teamDesignation}` : (typeof body?.name === "string" ? body.name.trim() : ""));
    if (!expectedName) return NextResponse.json({ ok: false, error: "Team not found." }, { status: 404 });
    if ((typeof body?.confirmation === "string" ? body.confirmation.trim().toLocaleLowerCase() : "") !== expectedName.toLocaleLowerCase()) {
      return NextResponse.json({ ok: false, error: `Type “${expectedName}” to confirm removal.` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, persisted: false, message: `${expectedName} removed for this demo view.` });
  }

  const [teamResult, memberResult] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase.from("team_members").select("*").eq("team_id", teamId)
  ]);
  if (teamResult.error) return NextResponse.json({ ok: false, error: teamResult.error.message }, { status: 500 });
  if (memberResult.error) return NextResponse.json({ ok: false, error: memberResult.error.message }, { status: 500 });
  const team = teamResult.data;
  if (!team) return NextResponse.json({ ok: false, error: "Team not found." }, { status: 404 });
  const expectedName = String(team.name || `${team.school_name} ${team.team_designation}`);
  if ((typeof body?.confirmation === "string" ? body.confirmation.trim().toLocaleLowerCase() : "") !== expectedName.toLocaleLowerCase()) {
    return NextResponse.json({ ok: false, error: `Type “${expectedName}” to confirm removal.` }, { status: 400 });
  }

  const memberships = (memberResult.data ?? []) as Array<Record<string, unknown>>;
  const snapshot = { team, ...membershipSnapshot(memberships) };
  const { error: deleteError } = await supabase.from("teams").delete().eq("id", teamId);
  if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "team.delete",
    target: expectedName,
    reason: "Admin removed a team",
    ip_address: clientIp(request),
    entity_table: "teams",
    entity_id: teamId,
    payload_before: snapshot,
    undo_action: "team.restore",
    is_reversible: true
  });
  if (auditError) {
    const { error: teamRestoreError } = await supabase.from("teams").insert(team);
    let memberRestoreError: { message: string } | null = null;
    if (!teamRestoreError && memberships.length > 0) {
      const restored = await supabase.from("team_members").insert(memberships);
      memberRestoreError = restored.error;
    }
    const rollbackError = teamRestoreError ?? memberRestoreError;
    return NextResponse.json(
      { ok: false, error: rollbackError ? `Could not audit or restore the team: ${auditError.message}; ${rollbackError.message}` : "Team removal was cancelled because its audit record could not be saved." },
      { status: 500 }
    );
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, persisted: true, message: `${expectedName} removed. Its members are now unassigned, and the change can be undone from the audit log.` });
}
