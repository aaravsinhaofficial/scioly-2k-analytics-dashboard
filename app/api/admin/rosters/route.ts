import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface RosterGroupInput {
  teamId?: string;
  memberIds?: string[];
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

  const groups = body.groups.map((group) => ({
    teamId: typeof group.teamId === "string" ? group.teamId : "",
    memberIds: Array.isArray(group.memberIds)
      ? group.memberIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : []
  }));
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

  await supabase.from("audit_logs").insert({
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

  return NextResponse.json({ ok: true, message: "Team rosters saved." });
}
