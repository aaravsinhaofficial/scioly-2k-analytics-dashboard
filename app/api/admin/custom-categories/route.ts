import { NextResponse } from "next/server";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function serializeCategory(category: Record<string, unknown>) {
  return {
    id: Number(category.id),
    name: String(category.name ?? ""),
    defaultPoints: Number(category.default_points ?? 0),
    maxPoints: Number(category.max_points ?? 500),
    isActive: Boolean(category.is_active)
  };
}

async function currentStudent() {
  return (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
}

function validateValues(body: { name?: string; defaultPoints?: number; maxPoints?: number }) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const defaultPoints = Number(body.defaultPoints);
  const maxPoints = Number(body.maxPoints);
  if (!name) return { error: "Category name is required." };
  if (name.length > 80) return { error: "Category names are limited to 80 characters." };
  if (!Number.isInteger(defaultPoints) || defaultPoints < 1 || defaultPoints > 500) {
    return { error: "Default points must be a whole number from 1 to 500." };
  }
  if (!Number.isInteger(maxPoints) || maxPoints < defaultPoints || maxPoints > 500) {
    return { error: "Maximum points must be a whole number between the default and 500." };
  }
  return { name, defaultPoints, maxPoints };
}

export async function GET(request: Request) {
  const currentUser = await currentStudent();
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in before loading point categories." }, { status: 401 });
  }

  const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
  if (includeInactive && currentUser.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only admins can view inactive categories." }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, categories: [] }, { headers: { "cache-control": "private, no-store" } });
  }

  let query = supabase
    .from("custom_point_categories")
    .select("id,name,default_points,max_points,is_active")
    .order("is_active", { ascending: false })
    .order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, categories: (data ?? []).map((category) => serializeCategory(category as Record<string, unknown>)) },
    { headers: { "cache-control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { name?: string; defaultPoints?: number; maxPoints?: number } | null;
  const currentUser = await currentStudent();
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in before creating categories." }, { status: 401 });
  if (currentUser.role !== "admin") return NextResponse.json({ ok: false, error: "Only admins can create point categories." }, { status: 403 });
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "Category details are required." }, { status: 400 });

  if ("isActive" in body && body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return NextResponse.json({ ok: false, error: "Category status must be true or false." }, { status: 400 });
  }
  const values = validateValues(body);
  if ("error" in values) return NextResponse.json({ ok: false, error: values.error }, { status: 400 });
  const { name, defaultPoints, maxPoints } = values;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, persisted: false, message: "Static demo: custom category staged locally." });

  const { data: before, error: beforeError } = await supabase
    .from("custom_point_categories")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ ok: false, error: beforeError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("custom_point_categories")
    .upsert({ name, default_points: defaultPoints, max_points: maxPoints, is_active: true }, { onConflict: "name" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: before ? (before.is_active ? "category.update" : "category.reactivate") : "category.create",
    target: name,
    reason: "Admin custom point category",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "custom_point_categories",
    entity_id: String(data.id),
    payload_before: before,
    payload_after: data,
    undo_action: "category.restore",
    is_reversible: true
  });
  if (auditError) {
    const rollback = before
      ? await supabase.from("custom_point_categories").update(before).eq("id", data.id)
      : await supabase.from("custom_point_categories").delete().eq("id", data.id);
    return NextResponse.json(
      { ok: false, error: rollback.error ? `Could not audit or roll back this category: ${auditError.message}; ${rollback.error.message}` : "The category change was cancelled because its audit record could not be saved." },
      { status: 500 }
    );
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, persisted: true, message: `${name} category saved.`, category: serializeCategory(data as Record<string, unknown>) });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: number; name?: string; defaultPoints?: number; maxPoints?: number; isActive?: boolean } | null;
  const currentUser = await currentStudent();
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in before editing categories." }, { status: 401 });
  if (currentUser.role !== "admin") return NextResponse.json({ ok: false, error: "Only admins can edit point categories." }, { status: 403 });
  if (!Number.isInteger(body?.id) || Number(body?.id) <= 0 || !body) return NextResponse.json({ ok: false, error: "A valid category is required." }, { status: 400 });

  if ("isActive" in body && body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return NextResponse.json({ ok: false, error: "Category status must be true or false." }, { status: 400 });
  }
  const values = validateValues(body);
  if ("error" in values) return NextResponse.json({ ok: false, error: values.error }, { status: 400 });
  const { name, defaultPoints, maxPoints } = values;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, persisted: false, message: "Static demo: category edit staged locally." });

  const { data: before, error: loadError } = await supabase.from("custom_point_categories").select("*").eq("id", body.id).maybeSingle();
  if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "Category not found." }, { status: 404 });

  const update = { name, default_points: defaultPoints, max_points: maxPoints, is_active: body.isActive ?? before.is_active };
  const { data, error } = await supabase.from("custom_point_categories").update(update).eq("id", body.id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "23505" ? 409 : 500 });

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: body.isActive === true && !before.is_active ? "category.reactivate" : "category.update",
    target: name,
    reason: "Admin custom point category edit",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "custom_point_categories",
    entity_id: String(body.id),
    payload_before: before,
    payload_after: data,
    undo_action: "category.restore",
    is_reversible: true
  });
  if (auditError) {
    const rollback = await supabase.from("custom_point_categories").update(before).eq("id", body.id);
    return NextResponse.json({ ok: false, error: rollback.error ? `Could not audit or roll back this category: ${auditError.message}; ${rollback.error.message}` : "The category edit was cancelled because its audit record could not be saved." }, { status: 500 });
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, message: `${name} updated.`, category: serializeCategory(data as Record<string, unknown>) });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: number } | null;
  const currentUser = await currentStudent();
  if (!currentUser) return NextResponse.json({ ok: false, error: "Sign in before deactivating categories." }, { status: 401 });
  if (currentUser.role !== "admin") return NextResponse.json({ ok: false, error: "Only admins can deactivate point categories." }, { status: 403 });
  if (!Number.isInteger(body?.id) || Number(body?.id) <= 0) return NextResponse.json({ ok: false, error: "A valid category is required." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: true, persisted: false, message: "Static demo: category deactivation staged locally." });
  const { data: before, error: loadError } = await supabase.from("custom_point_categories").select("*").eq("id", body!.id).maybeSingle();
  if (loadError) return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json({ ok: false, error: "Category not found." }, { status: 404 });
  if (!before.is_active) return NextResponse.json({ ok: true, message: `${before.name} is already inactive.` });

  const { data, error } = await supabase.from("custom_point_categories").update({ is_active: false }).eq("id", body!.id).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: currentUser.id,
    action: "category.deactivate",
    target: before.name,
    reason: "Admin deactivated custom point category",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "custom_point_categories",
    entity_id: String(body!.id),
    payload_before: before,
    payload_after: data,
    undo_action: "category.restore",
    is_reversible: true
  });
  if (auditError) {
    const rollback = await supabase.from("custom_point_categories").update(before).eq("id", body!.id);
    return NextResponse.json({ ok: false, error: rollback.error ? `Could not audit or roll back this category: ${auditError.message}; ${rollback.error.message}` : "The category deactivation was cancelled because its audit record could not be saved." }, { status: 500 });
  }

  invalidateAnalyticsCache();
  return NextResponse.json({ ok: true, message: `${before.name} deactivated. Existing point records are unchanged.`, category: serializeCategory(data as Record<string, unknown>) });
}
