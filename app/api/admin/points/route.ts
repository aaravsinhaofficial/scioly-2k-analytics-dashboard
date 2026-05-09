import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: number;
    decision?: "approved" | "rejected";
    notes?: string;
  };

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "Point log ID is required." }, { status: 400 });
  }

  if (body.decision !== "approved" && body.decision !== "rejected") {
    return NextResponse.json({ ok: false, error: "Decision must be approved or rejected." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const currentUser = (await getAuthenticatedStudent()) ?? (!hasSupabaseConfig() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before reviewing points." }, { status: 401 });
  }

  if (!roleMeets(currentUser.role, "officer")) {
    return NextResponse.json({ ok: false, error: "Officer access required." }, { status: 403 });
  }

  if (supabase) {
    const { data: before } = await supabase.from("grind_points").select("*").eq("id", body.id).maybeSingle();
    const { error } = await supabase
      .from("grind_points")
      .update({
        is_approved: body.decision === "approved",
        status: body.decision,
        approved_at: new Date().toISOString(),
        approved_by: currentUser.id,
        notes: body.notes ?? null
      })
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_id: currentUser.id,
      action: body.decision === "approved" ? "points.approve" : "points.reject",
      target: `Point log #${body.id}`,
      reason: body.notes ?? null,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      entity_table: "grind_points",
      entity_id: String(body.id),
      payload_before: before,
      payload_after: {
        status: body.decision,
        notes: body.notes ?? null
      },
      undo_action: body.decision === "approved" ? "points.unapprove" : "points.restore_pending",
      is_reversible: true
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      body.decision === "approved"
        ? "Point log approved and OVR recalculation queued."
        : "Point log rejected with audit note."
  });
}
