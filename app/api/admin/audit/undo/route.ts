import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as { auditId?: number; reason?: string };
  const currentUser = (await getAuthenticatedStudent()) ?? (!hasSupabaseConfig() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before undoing audit actions." }, { status: 401 });
  }

  if (currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admins can undo audit actions." }, { status: 403 });
  }

  if (!body.auditId) {
    return NextResponse.json({ ok: false, error: "Audit log ID is required." }, { status: 400 });
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

  if (entityTable === "tournaments" && entityId) {
    const { error } = await supabase.from("tournaments").delete().eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (entityTable === "grind_points" && entityId) {
    const { error } = await supabase
      .from("grind_points")
      .update({
        status: "pending",
        is_approved: false,
        approved_at: null,
        approved_by: null,
        notes: body.reason ?? "Restored by audit undo."
      })
      .eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (entityTable === "students" && entityId && audit.payload_before) {
    const before = audit.payload_before as Record<string, unknown>;
    const { error } = await supabase
      .from("students")
      .update({
        name: before.name,
        grade: before.grade,
        role: before.role,
        profile_events: before.profile_events ?? []
      })
      .eq("id", entityId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (entityTable === "custom_point_categories" && entityId) {
    const { error } = await supabase
      .from("custom_point_categories")
      .update({ is_active: false })
      .eq("id", Number(entityId));
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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

  return NextResponse.json({ ok: true, message: `Reversed audit #${body.auditId}.` });
}
