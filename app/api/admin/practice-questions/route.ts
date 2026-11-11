import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { getPracticeQuestions, practiceQuestionFromRow } from "@/lib/practice-data";
import type { PracticeQuestionMutationResponse, PracticeQuestionType } from "@/lib/practice-types";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface QuestionInput {
  id?: number;
  testId?: number;
  type?: PracticeQuestionType;
  prompt?: string;
  options?: string[];
  correctOption?: number;
  modelAnswer?: string;
  explanation?: string;
  points?: number;
  position?: number;
  isActive?: boolean;
  updatedAt?: string;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalize(input: QuestionInput) {
  const testId = Number(input.testId);
  const type = input.type;
  const prompt = clean(input.prompt, 8000);
  const explanation = clean(input.explanation, 12000);
  const points = Number(input.points ?? 1);
  const position = Number(input.position ?? 0);
  if (!Number.isInteger(testId) || testId <= 0) return { error: "Choose a valid practice test." } as const;
  if (type !== "mcq" && type !== "frq") return { error: "Choose MCQ or free response." } as const;
  if (!prompt) return { error: "Question text is required." } as const;
  if (!Number.isInteger(points) || points < 1 || points > 100) return { error: "Points must be from 1 to 100." } as const;
  if (!Number.isInteger(position) || position < 0 || position > 1000) return { error: "Question order is invalid." } as const;

  if (type === "mcq") {
    const options = Array.isArray(input.options) ? input.options.map((option) => clean(option, 1000)) : [];
    if (options.length < 2 || options.length > 6) return { error: "MCQs need 2 to 6 answer choices." } as const;
    if (options.some((option) => !option)) return { error: "Fill in every MCQ answer choice or remove the blank choice." } as const;
    if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
      return { error: "Each answer choice must be different." } as const;
    }
    const correctOption = input.correctOption;
    if (typeof correctOption !== "number" || !Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
      return { error: "Choose the correct MCQ answer." } as const;
    }
    return { value: {
      test_id: testId,
      question_type: type,
      prompt,
      options,
      correct_option: correctOption,
      model_answer: null,
      explanation: explanation || null,
      points,
      position,
    } } as const;
  }

  const modelAnswer = clean(input.modelAnswer, 12000);
  if (!modelAnswer) return { error: "Free-response questions need a model answer for review." } as const;
  return { value: {
    test_id: testId,
    question_type: type,
    prompt,
    options: [] as string[],
    correct_option: null,
    model_answer: modelAnswer,
    explanation: explanation || null,
    points,
    position,
  } } as const;
}

async function officer() {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return { response: NextResponse.json({ ok: false, error: "Sign in before editing practice tests." }, { status: 401 }) };
  if (!roleMeets(currentUser.role, "officer")) {
    return { response: NextResponse.json({ ok: false, error: "Only officers and admins can edit practice tests." }, { status: 403 }) };
  }
  return { currentUser };
}

async function validTest(testId: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return true;
  const { data, error } = await supabase.from("library_items").select("id").eq("id", testId).eq("kind", "test").maybeSingle();
  return !error && Boolean(data);
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
    reason: "Officer interactive practice test management",
    ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    entity_table: "practice_test_questions",
    entity_id: String(entry.id),
    payload_before: entry.before ?? null,
    payload_after: entry.after ?? null,
    undo_action: entry.undoAction,
    is_reversible: true,
  });
  return error;
}

export async function GET(request: Request) {
  const auth = await officer();
  if (auth.response) return auth.response;
  const testId = Number(new URL(request.url).searchParams.get("testId"));
  if (!Number.isInteger(testId) || testId <= 0) {
    return NextResponse.json({ ok: false, error: "Choose a valid practice test." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, questions: await getPracticeQuestions(testId, true) }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await officer();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as QuestionInput | null;
  const normalized = normalize(body ?? {});
  if ("error" in normalized) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: normalized.error }, { status: 400 });
  if (!await validTest(normalized.value.test_id)) {
    return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "That practice test no longer exists." }, { status: 404 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const now = new Date().toISOString();
    return NextResponse.json<PracticeQuestionMutationResponse>({
      ok: true,
      persisted: false,
      message: "Demo mode: question added for this session.",
      question: practiceQuestionFromRow({ id: Date.now(), ...normalized.value, is_active: true, created_at: now, updated_at: now }),
    });
  }
  const { data, error } = await supabase.from("practice_test_questions").insert({
    ...normalized.value,
    is_active: true,
    created_by: auth.currentUser.id,
    updated_by: auth.currentUser.id,
  }).select("*").single();
  if (error || !data) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: error?.message ?? "Could not add the question." }, { status: 500 });
  const auditError = await audit(request, { actorId: auth.currentUser.id, action: "practice_question.create", target: normalized.value.prompt, id: Number(data.id), after: data, undoAction: "practice_question.remove" });
  if (auditError) {
    await supabase.from("practice_test_questions").delete().eq("id", data.id);
    return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "The question was rolled back because its undo record could not be saved." }, { status: 500 });
  }
  return NextResponse.json<PracticeQuestionMutationResponse>({ ok: true, question: practiceQuestionFromRow(data), message: "Question added." });
}

export async function PATCH(request: Request) {
  const auth = await officer();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as QuestionInput | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "Choose a valid question." }, { status: 400 });
  const expectedUpdatedAt = typeof body?.updatedAt === "string" && Number.isFinite(new Date(body.updatedAt).getTime()) ? body.updatedAt : "";
  if (!expectedUpdatedAt) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "Reload this question before editing it." }, { status: 409 });
  const normalized = normalize(body ?? {});
  if ("error" in normalized) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: normalized.error }, { status: 400 });
  if (!await validTest(normalized.value.test_id)) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "That practice test no longer exists." }, { status: 404 });
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const now = new Date().toISOString();
    return NextResponse.json<PracticeQuestionMutationResponse>({ ok: true, persisted: false, message: "Demo mode: question updated for this session.", question: practiceQuestionFromRow({ id, ...normalized.value, is_active: body?.isActive !== false, created_at: now, updated_at: now }) });
  }
  const { data: before, error: loadError } = await supabase.from("practice_test_questions").select("*").eq("id", id).maybeSingle();
  if (loadError) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "Question not found." }, { status: 404 });
  if (String(before.updated_at) !== expectedUpdatedAt) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "This question changed in another session. Reload before saving." }, { status: 409 });
  const update = { ...normalized.value, is_active: body?.isActive !== false, updated_by: auth.currentUser.id, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("practice_test_questions").update(update).eq("id", id).eq("updated_at", expectedUpdatedAt).select("*").maybeSingle();
  if (error) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "This question changed in another session. Reload before saving." }, { status: 409 });
  const auditError = await audit(request, { actorId: auth.currentUser.id, action: body?.isActive === true && before.is_active === false ? "practice_question.restore" : "practice_question.update", target: normalized.value.prompt, id, before, after: data, undoAction: "practice_question.restore" });
  if (auditError) {
    const { id: _id, ...snapshot } = before;
    await supabase.from("practice_test_questions").update(snapshot).eq("id", id);
    return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "The edit was rolled back because its undo record could not be saved." }, { status: 500 });
  }
  return NextResponse.json<PracticeQuestionMutationResponse>({ ok: true, question: practiceQuestionFromRow(data), message: "Question updated." });
}

export async function DELETE(request: Request) {
  const auth = await officer();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { id?: number; updatedAt?: string } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "Choose a valid question." }, { status: 400 });
  const expectedUpdatedAt = typeof body?.updatedAt === "string" && Number.isFinite(new Date(body.updatedAt).getTime()) ? body.updatedAt : "";
  if (!expectedUpdatedAt) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "Reload this question before removing it." }, { status: 409 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: true, persisted: false, message: "Demo mode: question removed for this session." });
  const { data: before, error: loadError } = await supabase.from("practice_test_questions").select("*").eq("id", id).maybeSingle();
  if (loadError) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: loadError.message }, { status: 500 });
  if (!before) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "Question not found." }, { status: 404 });
  if (String(before.updated_at) !== expectedUpdatedAt) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "This question changed in another session. Reload before removing it." }, { status: 409 });
  if (before.is_active === false) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "This question is already removed." }, { status: 409 });
  const removal = { is_active: false, updated_by: auth.currentUser.id, updated_at: new Date().toISOString() };
  const { data: after, error } = await supabase.from("practice_test_questions").update(removal).eq("id", id).eq("is_active", true).eq("updated_at", expectedUpdatedAt).select("*").maybeSingle();
  if (error) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!after) return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "This question changed in another session. Reload and try again." }, { status: 409 });
  const auditError = await audit(request, { actorId: auth.currentUser.id, action: "practice_question.remove", target: String(before.prompt), id, before, after, undoAction: "practice_question.restore" });
  if (auditError) {
    const { id: _id, ...snapshot } = before;
    await supabase.from("practice_test_questions").update(snapshot).eq("id", id);
    return NextResponse.json<PracticeQuestionMutationResponse>({ ok: false, error: "The removal was rolled back because its undo record could not be saved." }, { status: 500 });
  }
  return NextResponse.json<PracticeQuestionMutationResponse>({ ok: true, question: practiceQuestionFromRow(after), message: "Question removed. It can be restored from this editor." });
}
