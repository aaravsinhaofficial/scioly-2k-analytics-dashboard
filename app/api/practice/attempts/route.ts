import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import type {
  FrqSelfReview,
  PracticeAttemptQuestion,
  PracticeAttemptResponse,
  PracticeAttemptSummary,
  PracticeAttemptView,
} from "@/lib/practice-types";
import { isCorrectMcqAnswer, normalizeAnswers, normalizeReviews, score } from "@/lib/practice-scoring";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;

interface SnapshotQuestion extends PracticeAttemptQuestion {
  correctOption?: number;
  modelAnswer?: string;
  explanation?: string;
}

function snapshot(value: unknown): SnapshotQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as DbRow;
    const id = Number(row.id);
    const points = Number(row.points);
    const position = Number(row.position);
    const type = row.type === "frq" ? "frq" : row.type === "mcq" ? "mcq" : null;
    if (!Number.isInteger(id) || !type || typeof row.prompt !== "string" || !Number.isFinite(points)) return [];
    const options = Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === "string") : [];
    return [{
      id,
      type,
      prompt: row.prompt,
      options,
      points,
      position: Number.isFinite(position) ? position : 0,
      correctOption: row.correctOption === null || row.correctOption === undefined ? undefined : Number(row.correctOption),
      modelAnswer: typeof row.modelAnswer === "string" ? row.modelAnswer : undefined,
      explanation: typeof row.explanation === "string" ? row.explanation : undefined,
    } satisfies SnapshotQuestion];
  }).sort((left, right) => left.position - right.position || left.id - right.id);
}

function summary(row: DbRow): PracticeAttemptSummary {
  const status = row.status === "submitted" ? "submitted" : row.status === "discarded" ? "discarded" : "in_progress";
  return {
    id: String(row.id),
    status,
    mcqCorrect: Number(row.mcq_correct ?? 0),
    mcqTotal: Number(row.mcq_total ?? 0),
    earnedPoints: Number(row.earned_points ?? 0),
    maxPoints: Number(row.max_points ?? 0),
    startedAt: String(row.started_at),
    submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : undefined,
    discardedAt: typeof row.discarded_at === "string" ? row.discarded_at : undefined,
    version: Number(row.version ?? 1),
  };
}

function view(row: DbRow, test: { title: string; eventName: string }): PracticeAttemptView {
  const questions = snapshot(row.question_snapshot);
  const answers = normalizeAnswers(row.answers, questions);
  const frqReviews = normalizeReviews(row.frq_reviews, questions);
  const submitted = row.status === "submitted";
  return {
    ...summary(row),
    testId: Number(row.test_id),
    testTitle: test.title,
    eventName: test.eventName,
    questions: questions.map((question) => submitted ? {
      ...question,
      isCorrect: question.type === "mcq" ? isCorrectMcqAnswer(question, answers[String(question.id)]) : undefined,
    } : {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      points: question.points,
      position: question.position,
    }),
    answers,
    frqReviews,
    updatedAt: String(row.updated_at ?? row.started_at),
  };
}

async function context() {
  const currentUser = await getAuthenticatedStudent();
  if (!currentUser) return { response: NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Sign in before taking a practice test." }, { status: 401 }) };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { response: NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Interactive practice storage is not configured yet." }, { status: 503 }) };
  return { currentUser, supabase };
}

async function testRecord(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, testId: number, includeInactive = false) {
  let query = supabase.from("library_items").select("id,title,event_name,is_active,kind").eq("id", testId).eq("kind", "test");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return { id: Number(data.id), title: String(data.title), eventName: String(data.event_name) };
}

async function loadAttempt(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, attemptId: string, studentId: string) {
  return supabase.from("practice_test_attempts").select("*").eq("id", attemptId).eq("student_id", studentId).maybeSingle();
}

export async function GET(request: Request) {
  const auth = await context();
  if (auth.response) return auth.response;
  const searchParams = new URL(request.url).searchParams;
  const attemptId = searchParams.get("attemptId")?.trim();
  if (attemptId) {
    const loaded = await loadAttempt(auth.supabase, attemptId, auth.currentUser.id);
    if (loaded.error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: loaded.error.message }, { status: 500 });
    if (!loaded.data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Practice attempt not found." }, { status: 404 });
    const test = await testRecord(auth.supabase, Number(loaded.data.test_id), true);
    if (!test) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "The parent practice test no longer exists." }, { status: 409 });
    return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(loaded.data as DbRow, test) }, { headers: { "cache-control": "private, no-store" } });
  }
  const testId = Number(searchParams.get("testId"));
  if (!Number.isInteger(testId) || testId <= 0) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Choose a valid practice test." }, { status: 400 });
  const test = await testRecord(auth.supabase, testId);
  if (!test) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This practice test is unavailable." }, { status: 404 });
  const { data, error } = await auth.supabase.from("practice_test_attempts").select("*").eq("student_id", auth.currentUser.id).eq("test_id", testId).order("started_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: error.code === "42P01" ? "Apply the latest database schema to enable interactive practice." : error.message }, { status: 500 });
  const rows = (data ?? []) as DbRow[];
  const open = rows.find((row) => row.status === "in_progress");
  return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: open ? view(open, test) : undefined, history: rows.map(summary) }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await context();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { testId?: number } | null;
  const testId = Number(body?.testId);
  if (!Number.isInteger(testId) || testId <= 0) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Choose a valid practice test." }, { status: 400 });
  const test = await testRecord(auth.supabase, testId);
  if (!test) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This practice test is unavailable." }, { status: 404 });
  const existing = await auth.supabase.from("practice_test_attempts").select("*").eq("student_id", auth.currentUser.id).eq("test_id", testId).eq("status", "in_progress").maybeSingle();
  if (existing.error && existing.error.code !== "42P01") return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: existing.error.message }, { status: 500 });
  if (existing.data) return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(existing.data as DbRow, test), message: "Resumed your open attempt." });
  const { data: questionRows, error: questionError } = await auth.supabase.from("practice_test_questions").select("*").eq("test_id", testId).eq("is_active", true).order("position").order("id");
  if (questionError) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: questionError.code === "42P01" ? "Apply the latest database schema to enable interactive practice." : questionError.message }, { status: 500 });
  const questions = (questionRows ?? []).map((row) => ({
    id: Number(row.id),
    type: row.question_type === "frq" ? "frq" as const : "mcq" as const,
    prompt: String(row.prompt),
    options: Array.isArray(row.options) ? (row.options as unknown[]).filter((option): option is string => typeof option === "string") : [],
    correctOption: row.correct_option === null ? undefined : Number(row.correct_option),
    modelAnswer: typeof row.model_answer === "string" ? row.model_answer : undefined,
    explanation: typeof row.explanation === "string" ? row.explanation : undefined,
    points: Number(row.points),
    position: Number(row.position),
  } satisfies SnapshotQuestion));
  if (questions.length === 0) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This test does not have any active questions yet." }, { status: 409 });
  const totals = score(questions, {}, {});
  const { data, error } = await auth.supabase.from("practice_test_attempts").insert({ test_id: testId, student_id: auth.currentUser.id, question_snapshot: questions, max_points: totals.maxPoints }).select("*").single();
  if (error || !data) {
    if (error?.code === "23505") {
      const retry = await auth.supabase.from("practice_test_attempts").select("*").eq("student_id", auth.currentUser.id).eq("test_id", testId).eq("status", "in_progress").maybeSingle();
      if (retry.data) return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(retry.data as DbRow, test), message: "Resumed your open attempt." });
    }
    return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: error?.message ?? "Could not start the practice test." }, { status: 500 });
  }
  return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(data as DbRow, test), message: "Practice test started." });
}

export async function PATCH(request: Request) {
  const auth = await context();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { attemptId?: string; version?: number; answers?: unknown; action?: "self_review"; frqReviews?: unknown } | null;
  if (!body?.attemptId) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Attempt ID is required." }, { status: 400 });
  const expectedVersion = Number(body.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Reload this attempt before saving." }, { status: 409 });
  const loaded = await loadAttempt(auth.supabase, body.attemptId, auth.currentUser.id);
  if (loaded.error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: loaded.error.message }, { status: 500 });
  if (!loaded.data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Practice attempt not found." }, { status: 404 });
  const row = loaded.data as DbRow;
  const questions = snapshot(row.question_snapshot);
  const test = await testRecord(auth.supabase, Number(row.test_id), true);
  if (!test) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This practice test is unavailable." }, { status: 404 });
  if (Number(row.version ?? 1) !== expectedVersion) return NextResponse.json<PracticeAttemptResponse>({ ok: false, attempt: view(row, test), error: "This attempt changed in another tab. Reload before continuing." }, { status: 409 });

  if (body.action === "self_review") {
    if (row.status !== "submitted") return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Submit the test before reviewing free responses." }, { status: 409 });
    const answers = normalizeAnswers(row.answers, questions);
    const reviews = Object.fromEntries(
      Object.entries(normalizeReviews(body.frqReviews, questions)).filter(([id]) => {
        const answer = answers[id];
        return typeof answer === "string" && answer.trim().length > 0;
      })
    ) as Record<string, FrqSelfReview>;
    const totals = score(questions, answers, reviews);
    const { data, error } = await auth.supabase.from("practice_test_attempts").update({ frq_reviews: reviews, earned_points: totals.earnedPoints, version: expectedVersion + 1, updated_at: new Date().toISOString() }).eq("id", body.attemptId).eq("student_id", auth.currentUser.id).eq("status", "submitted").eq("version", expectedVersion).select("*").maybeSingle();
    if (error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This review changed in another tab. Reload before continuing." }, { status: 409 });
    return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(data as DbRow, test), message: "Self-review saved." });
  }

  if (row.status !== "in_progress") return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This attempt has already been submitted." }, { status: 409 });
  const answers = normalizeAnswers(body.answers, questions);
  const { data, error } = await auth.supabase.from("practice_test_attempts").update({ answers, version: expectedVersion + 1, updated_at: new Date().toISOString() }).eq("id", body.attemptId).eq("student_id", auth.currentUser.id).eq("status", "in_progress").eq("version", expectedVersion).select("*").maybeSingle();
  if (error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This attempt changed in another tab. Reload before continuing." }, { status: 409 });
  return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(data as DbRow, test), message: "Progress saved." });
}

export async function PUT(request: Request) {
  const auth = await context();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { attemptId?: string; version?: number; answers?: unknown } | null;
  if (!body?.attemptId) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Attempt ID is required." }, { status: 400 });
  const expectedVersion = Number(body.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Reload this attempt before submitting." }, { status: 409 });
  const loaded = await loadAttempt(auth.supabase, body.attemptId, auth.currentUser.id);
  if (loaded.error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: loaded.error.message }, { status: 500 });
  if (!loaded.data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Practice attempt not found." }, { status: 404 });
  const row = loaded.data as DbRow;
  const test = await testRecord(auth.supabase, Number(row.test_id), true);
  if (!test) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This practice test is unavailable." }, { status: 404 });
  if (Number(row.version ?? 1) !== expectedVersion) return NextResponse.json<PracticeAttemptResponse>({ ok: false, attempt: view(row, test), error: "This attempt changed in another tab. Reload before submitting." }, { status: 409 });
  const questions = snapshot(row.question_snapshot);
  const answers = normalizeAnswers(body.answers, questions);
  const totals = score(questions, answers, {});
  const now = new Date().toISOString();
  const { data, error } = await auth.supabase.from("practice_test_attempts").update({ status: "submitted", answers, mcq_correct: totals.mcqCorrect, mcq_total: totals.mcqTotal, earned_points: totals.earnedPoints, max_points: totals.maxPoints, version: expectedVersion + 1, submitted_at: now, updated_at: now }).eq("id", body.attemptId).eq("student_id", auth.currentUser.id).eq("status", "in_progress").eq("version", expectedVersion).select("*").maybeSingle();
  if (error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This attempt was already submitted in another tab." }, { status: 409 });
  return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(data as DbRow, test), message: totals.mcqTotal ? `Submitted: ${totals.mcqCorrect} of ${totals.mcqTotal} multiple-choice correct.` : "Submitted. Review your free responses against the model answers." });
}

export async function DELETE(request: Request) {
  const auth = await context();
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null) as { attemptId?: string; version?: number } | null;
  if (!body?.attemptId) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Attempt ID is required." }, { status: 400 });
  const expectedVersion = Number(body.version);
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Reload this attempt before discarding it." }, { status: 409 });
  const loaded = await loadAttempt(auth.supabase, body.attemptId, auth.currentUser.id);
  if (loaded.error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: loaded.error.message }, { status: 500 });
  if (!loaded.data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "Practice attempt not found." }, { status: 404 });
  const row = loaded.data as DbRow;
  const test = await testRecord(auth.supabase, Number(row.test_id), true);
  if (!test) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This practice test is unavailable." }, { status: 404 });
  if (row.status !== "in_progress") return NextResponse.json<PracticeAttemptResponse>({ ok: false, attempt: view(row, test), error: "Only an open attempt can be discarded." }, { status: 409 });
  if (Number(row.version ?? 1) !== expectedVersion) return NextResponse.json<PracticeAttemptResponse>({ ok: false, attempt: view(row, test), error: "This attempt changed in another tab. Reload before discarding it." }, { status: 409 });
  const now = new Date().toISOString();
  const { data, error } = await auth.supabase.from("practice_test_attempts").update({ status: "discarded", discarded_at: now, updated_at: now, version: expectedVersion + 1 }).eq("id", body.attemptId).eq("student_id", auth.currentUser.id).eq("status", "in_progress").eq("version", expectedVersion).select("*").maybeSingle();
  if (error) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json<PracticeAttemptResponse>({ ok: false, error: "This attempt changed in another tab. Reload before discarding it." }, { status: 409 });
  return NextResponse.json<PracticeAttemptResponse>({ ok: true, attempt: view(data as DbRow, test), message: "Open attempt discarded. Its history was kept." });
}
