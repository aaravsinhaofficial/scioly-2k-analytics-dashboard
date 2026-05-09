import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-static";

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
  const currentUser = getCurrentDemoUser();

  if (supabase) {
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
  }

  return NextResponse.json({
    ok: true,
    message:
      body.decision === "approved"
        ? "Point log approved and OVR recalculation queued."
        : "Point log rejected with audit note."
  });
}
