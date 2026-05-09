import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    defaultPoints?: number;
    maxPoints?: number;
  };
  const currentUser = (await getAuthenticatedStudent()) ?? (!hasSupabaseConfig() ? getCurrentDemoUser() : null);

  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before creating categories." }, { status: 401 });
  }

  if (currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admins can create point categories." }, { status: 403 });
  }

  const name = body.name?.trim();
  const defaultPoints = Math.max(0, Math.round(body.defaultPoints ?? 0));
  const maxPoints = Math.max(defaultPoints, Math.round(body.maxPoints ?? 500));
  if (!name) {
    return NextResponse.json({ ok: false, error: "Category name is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Static demo: custom category staged locally." });
  }

  const { data, error } = await supabase
    .from("custom_point_categories")
    .upsert(
      {
        name,
        default_points: defaultPoints,
        max_points: maxPoints,
        is_active: true
      },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "category.upsert",
    target: name,
    reason: "Admin custom point category",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "custom_point_categories",
    entity_id: String(data?.id ?? ""),
    payload_after: { name, default_points: defaultPoints, max_points: maxPoints },
    undo_action: "category.deactivate",
    is_reversible: true
  });

  return NextResponse.json({ ok: true, message: `${name} category saved.` });
}
