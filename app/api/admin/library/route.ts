import { NextResponse } from "next/server";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getLibraryEventOptions, getManagedLibraryItems, invalidateLibraryCache, libraryItemFromRow } from "@/lib/library-data";
import type { LibraryItem, LibraryItemKind, LibraryMutationResponse } from "@/lib/library-types";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

const kinds = new Set<LibraryItemKind>(["resource", "guide", "question", "test"]);
const difficulties = new Set(["Rookie", "Pro", "All-Star"]);
const testFormats = new Set(["Mini Test", "Full Test", "Testoff Set"]);

interface LibraryInput {
  id?: number;
  updatedAt?: string;
  eventSlug?: string;
  eventName?: string;
  kind?: LibraryItemKind;
  title?: string;
  description?: string;
  topic?: string;
  difficulty?: "Rookie" | "Pro" | "All-Star";
  resourceType?: string;
  url?: string;
  body?: string;
  answer?: string;
  explanation?: string;
  testFormat?: "Mini Test" | "Full Test" | "Testoff Set";
  isFeatured?: boolean;
  isActive?: boolean;
}

interface NormalizedLibraryRow {
  event_slug: string;
  event_name: string;
  kind: LibraryItemKind;
  title: string;
  description: string | null;
  topic: string | null;
  difficulty: "Rookie" | "Pro" | "All-Star" | null;
  resource_type: string | null;
  url: string | null;
  body: string | null;
  answer: string | null;
  explanation: string | null;
  test_format: "Mini Test" | "Full Test" | "Testoff Set" | null;
  is_featured: boolean;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function validUrl(value: string) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeInput(body: LibraryInput): { value: NormalizedLibraryRow } | { error: string } {
  const eventName = cleanText(body.eventName, 120);
  const suppliedSlug = cleanText(body.eventSlug, 80);
  const eventSlug = slugify(suppliedSlug || eventName);
  const kind = body.kind;
  const title = cleanText(body.title, 240);
  const description = cleanText(body.description, 1200);
  const topic = cleanText(body.topic, 120);
  const resourceType = cleanText(body.resourceType, 80);
  const url = cleanText(body.url, 1000);
  const contentBody = cleanText(body.body, 20000);
  const answer = cleanText(body.answer, 4000);
  const explanation = cleanText(body.explanation, 8000);
  const difficulty = body.difficulty && difficulties.has(body.difficulty) ? body.difficulty : null;
  const testFormat = body.testFormat && testFormats.has(body.testFormat) ? body.testFormat : null;

  if (!eventName || !eventSlug || !kind || !kinds.has(kind) || !title) {
    return { error: "Event, item type, and title are required." } as const;
  }
  if (!validUrl(url)) return { error: "Links must start with http:// or https://." } as const;
  if (kind === "question" && !answer) return { error: "Practice questions need an answer." } as const;
  if (kind === "guide" && !contentBody) return { error: "Guide text cannot be empty." } as const;
  if (kind === "resource" && !url && !contentBody) {
    return { error: "Resources need a link or usable text." } as const;
  }

  return {
    value: {
      event_slug: eventSlug,
      event_name: eventName,
      kind,
      title,
      description: description || null,
      topic: topic || null,
      difficulty,
      resource_type: kind === "resource" ? resourceType || "Guide" : null,
      url: url || null,
      body: contentBody || null,
      answer: kind === "question" ? answer : null,
      explanation: kind === "question" ? explanation || null : null,
      test_format: kind === "test" ? testFormat ?? "Mini Test" : null,
      is_featured: Boolean(body.isFeatured),
    }
  } as const;
}

async function canonicalEvent(value: NormalizedLibraryRow) {
  const event = (await getLibraryEventOptions()).find((option) => option.slug === value.event_slug);
  return event
    ? { ...value, event_slug: event.slug, event_name: event.name }
    : null;
}

async function getMember() {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return { response: NextResponse.json({ ok: false, error: "Sign in before managing the library." }, { status: 401 }) };
  return { currentUser, canModerate: roleMeets(currentUser.role, "officer") };
}

function demoItem(input: NormalizedLibraryRow, id = Date.now()): LibraryItem {
  const now = new Date().toISOString();
  return libraryItemFromRow({ id, ...input, is_active: true, created_at: now, updated_at: now });
}

export async function GET() {
  const auth = await getMember();
  if (auth.response) return auth.response;
  return NextResponse.json(
    { ok: true, items: await getManagedLibraryItems(auth.canModerate) },
    { headers: { "cache-control": "private, no-store" } }
  );
}

async function audit(request: Request, entry: {
  actorId: string;
  action: string;
  target: string;
  id: number;
  before?: unknown;
  after?: unknown;
  undoAction: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    target: entry.target,
    reason: "Event library management",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "library_items",
    entity_id: String(entry.id),
    payload_before: entry.before ?? null,
    payload_after: entry.after ?? null,
    undo_action: entry.undoAction,
    is_reversible: true,
  });
  return error;
}

export async function POST(request: Request) {
  const auth = await getMember();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null) as LibraryInput | null;
  const normalized = normalizeInput(body ?? {});
  if ("error" in normalized) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: normalized.error }, { status: 400 });
  }
  const canonicalValue = await canonicalEvent(normalized.value);
  if (!canonicalValue) {
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "Choose an event from the current event library." },
      { status: 400 }
    );
  }
  if (!auth.canModerate && canonicalValue.kind !== "resource") {
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "Members can contribute resource links and notes. Officers manage guides, questions, and tests." },
      { status: 403 }
    );
  }
  const value = {
    ...canonicalValue,
    is_featured: auth.canModerate && canonicalValue.is_featured,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) {
      return NextResponse.json<LibraryMutationResponse>(
        { ok: false, error: "Library contributions are unavailable because SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      );
    }
    return NextResponse.json<LibraryMutationResponse>({
      ok: true,
      item: demoItem(value),
      message: "Demo mode: item added for this session.",
      persisted: false,
    });
  }

  const { data, error } = await supabase
    .from("library_items")
    .insert({ ...value, created_by: auth.currentUser.id, updated_by: auth.currentUser.id, is_active: true })
    .select("*")
    .single();
  if (error || !data) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: error?.message ?? "Could not add the library item." }, { status: 500 });
  }

  const auditError = await audit(request, {
    actorId: auth.currentUser.id,
    action: "library.create",
    target: value.title,
    id: Number(data.id),
    after: data,
    undoAction: "library.remove",
  });
  if (auditError) {
    await supabase.from("library_items").delete().eq("id", Number(data.id));
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "The item was rolled back because its undo record could not be saved." },
      { status: 500 }
    );
  }
  invalidateLibraryCache();
  return NextResponse.json<LibraryMutationResponse>({
    ok: true,
    item: libraryItemFromRow(data),
    message: value.kind === "test"
      ? `${value.title} added. Use Edit questions to build the interactive test.`
      : `${value.title} added.`
  });
}

export async function PATCH(request: Request) {
  const auth = await getMember();
  if (auth.response) return auth.response;
  if (!auth.canModerate) {
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "Only officers and admins can edit or restore library items." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null) as LibraryInput | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Choose a valid library item." }, { status: 400 });
  }
  const expectedUpdatedAt = typeof body?.updatedAt === "string" && Number.isFinite(new Date(body.updatedAt).getTime())
    ? body.updatedAt
    : "";
  if (!expectedUpdatedAt) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Reload this library item before editing it." }, { status: 409 });
  }
  const normalized = normalizeInput(body ?? {});
  if ("error" in normalized) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: normalized.error }, { status: 400 });
  }
  const value = await canonicalEvent(normalized.value);
  if (!value) {
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "Choose an event from the current event library." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) {
      return NextResponse.json<LibraryMutationResponse>(
        { ok: false, error: "Library editing is unavailable because SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      );
    }
    return NextResponse.json<LibraryMutationResponse>({
      ok: true,
      item: { ...demoItem(value, id), isActive: body?.isActive !== false },
      message: "Demo mode: item updated for this session.",
      persisted: false,
    });
  }

  const { data: before, error: loadError } = await supabase.from("library_items").select("*").eq("id", id).maybeSingle();
  if (loadError) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Library item not found." }, { status: 404 });
  if (String(before.updated_at) !== expectedUpdatedAt) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "This library item changed in another session. Reload before saving." }, { status: 409 });
  }
  if (value.kind !== before.kind) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Item type cannot be changed after creation. Create a new item instead." }, { status: 409 });
  }

  const update = {
    ...value,
    is_active: body?.isActive !== false,
    updated_by: auth.currentUser.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("library_items")
    .update(update)
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "This library item changed in another session. Reload before saving." }, { status: 409 });

  const auditError = await audit(request, {
    actorId: auth.currentUser.id,
    action: body?.isActive !== false && before.is_active === false ? "library.restore" : "library.update",
    target: value.title,
    id,
    before,
    after: data,
    undoAction: "library.restore",
  });
  if (auditError) {
    const { id: _id, ...snapshot } = before;
    await supabase.from("library_items").update(snapshot).eq("id", id);
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "The edit was rolled back because its undo record could not be saved." },
      { status: 500 }
    );
  }
  invalidateLibraryCache();
  return NextResponse.json<LibraryMutationResponse>({ ok: true, item: libraryItemFromRow(data), message: `${value.title} updated.` });
}

export async function DELETE(request: Request) {
  const auth = await getMember();
  if (auth.response) return auth.response;
  if (!auth.canModerate) {
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "Only officers and admins can remove library items." },
      { status: 403 }
    );
  }
  const body = await request.json().catch(() => null) as { id?: number; updatedAt?: string } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Choose a valid library item." }, { status: 400 });
  }
  const expectedUpdatedAt = typeof body?.updatedAt === "string" && Number.isFinite(new Date(body.updatedAt).getTime())
    ? body.updatedAt
    : "";
  if (!expectedUpdatedAt) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Reload this library item before removing it." }, { status: 409 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    if (!isDemoMode()) {
      return NextResponse.json<LibraryMutationResponse>(
        { ok: false, error: "Library moderation is unavailable because SUPABASE_SERVICE_ROLE_KEY is missing." },
        { status: 503 }
      );
    }
    return NextResponse.json<LibraryMutationResponse>({ ok: true, message: "Demo mode: item removed for this session.", persisted: false });
  }
  const { data: before, error: loadError } = await supabase.from("library_items").select("*").eq("id", id).maybeSingle();
  if (loadError) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "Library item not found." }, { status: 404 });
  if (String(before.updated_at) !== expectedUpdatedAt) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "This library item changed in another session. Reload before removing it." }, { status: 409 });
  }
  if (before.is_active === false) {
    return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "This library item is already removed." }, { status: 409 });
  }

  const updatedAt = new Date().toISOString();
  const { data: after, error } = await supabase
    .from("library_items")
    .update({ is_active: false, updated_by: auth.currentUser.id, updated_at: updatedAt })
    .eq("id", id)
    .eq("is_active", true)
    .eq("updated_at", expectedUpdatedAt)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!after) return NextResponse.json<LibraryMutationResponse>({ ok: false, error: "This library item changed in another session. Reload before removing it." }, { status: 409 });

  const auditError = await audit(request, {
    actorId: auth.currentUser.id,
    action: "library.remove",
    target: String(before.title),
    id,
    before,
    after,
    undoAction: "library.restore",
  });
  if (auditError) {
    const { id: _id, ...snapshot } = before;
    await supabase.from("library_items").update(snapshot).eq("id", id);
    return NextResponse.json<LibraryMutationResponse>(
      { ok: false, error: "The removal was rolled back because its undo record could not be saved." },
      { status: 500 }
    );
  }
  invalidateLibraryCache();
  return NextResponse.json<LibraryMutationResponse>({ ok: true, item: libraryItemFromRow(after), message: `${String(before.title)} removed. You can restore it below.` });
}
