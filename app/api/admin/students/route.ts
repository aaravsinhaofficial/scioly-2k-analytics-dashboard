import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";

const roles = new Set<UserRole>(["viewer", "officer", "admin"]);

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    grade?: number;
    role?: UserRole;
    profileEvents?: string[];
  };

  const currentUser = (await getAuthenticatedStudent()) ?? (!hasSupabaseConfig() ? getCurrentDemoUser() : null);
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before editing accounts." }, { status: 401 });
  }

  if (currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admins can manage accounts." }, { status: 403 });
  }

  if (!body.id || !body.name?.trim() || !body.role || !roles.has(body.role)) {
    return NextResponse.json({ ok: false, error: "Student, name, and role are required." }, { status: 400 });
  }

  const profileEvents = Array.isArray(body.profileEvents)
    ? body.profileEvents.map((event) => event.trim()).filter(Boolean)
    : [];

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Static demo: account edit staged locally." });
  }

  const { data: before } = await supabase.from("students").select("*").eq("id", body.id).maybeSingle();
  const { error } = await supabase
    .from("students")
    .update({
      name: body.name.trim(),
      grade: body.grade ?? null,
      role: body.role,
      profile_events: profileEvents
    })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "student.update",
    target: body.name.trim(),
    reason: "Admin account/profile edit",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "students",
    entity_id: body.id,
    payload_before: before,
    payload_after: {
      name: body.name.trim(),
      grade: body.grade ?? null,
      role: body.role,
      profile_events: profileEvents
    },
    undo_action: "student.restore",
    is_reversible: true
  });

  return NextResponse.json({ ok: true, message: `${body.name.trim()} updated.` });
}
