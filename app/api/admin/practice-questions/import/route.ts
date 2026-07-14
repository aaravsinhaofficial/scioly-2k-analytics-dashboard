import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import {
  parsePracticeQuestionCsv,
  PRACTICE_QUESTION_CSV_MAX_BYTES,
  PRACTICE_QUESTION_CSV_MAX_ROWS,
} from "@/lib/practice-question-csv";
import { practiceQuestionFromRow } from "@/lib/practice-data";
import type {
  PracticeQuestionCsvError,
  PracticeQuestionCsvImportResponse,
  PracticeQuestionCsvPreview,
  PracticeQuestionCsvPreviewRow,
} from "@/lib/practice-types";
import { getSupabaseAdmin, isDemoMode } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ImportRequest {
  testId?: number;
  rawCsv?: string;
  commit?: boolean;
}

function json(
  body: PracticeQuestionCsvImportResponse,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

async function officer() {
  const currentUser = (await getAuthenticatedStudent()) ?? (isDemoMode() ? getCurrentDemoUser() : null);
  if (!currentUser) return { response: json({ ok: false, error: "Sign in before importing practice questions." }, 401) };
  if (!roleMeets(currentUser.role, "officer")) {
    return { response: json({ ok: false, error: "Only officers and admins can import practice questions." }, 403) };
  }
  return { currentUser };
}

function csvByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function resolvePositions(
  rows: ReturnType<typeof parsePracticeQuestionCsv>["rows"],
  currentMax: number,
) {
  const errors: PracticeQuestionCsvError[] = [];
  let nextPosition = Math.max(currentMax, ...rows.map((row) => row.position ?? -1)) + 1;
  const resolvedRows: PracticeQuestionCsvPreviewRow[] = rows.map((row) => {
    const position = row.position ?? nextPosition++;
    if (position > 1000) {
      errors.push({
        row: row.sourceRow,
        field: "Order",
        message: "No order is available after the test's current maximum. Enter an Order from 0 to 1,000.",
      });
    }
    return { ...row, position };
  });
  return { rows: resolvedRows, errors };
}

function previewFrom(
  parsed: ReturnType<typeof parsePracticeQuestionCsv>,
  currentMax: number,
): PracticeQuestionCsvPreview {
  const resolved = resolvePositions(parsed.rows, currentMax);
  const errors = [...parsed.errors, ...resolved.errors];
  return {
    rows: resolved.rows,
    errors,
    rowCount: parsed.rowCount,
    canImport: parsed.canImport && errors.length === 0,
    maxRows: PRACTICE_QUESTION_CSV_MAX_ROWS,
  };
}

export async function POST(request: Request) {
  const auth = await officer();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null) as ImportRequest | null;
  const testId = Number(body?.testId);
  const rawCsv = typeof body?.rawCsv === "string" ? body.rawCsv : "";
  const commit = body?.commit === true;
  if (!Number.isInteger(testId) || testId <= 0) {
    return json({ ok: false, error: "Choose a valid practice test." }, 400);
  }
  if (!rawCsv.trim()) return json({ ok: false, error: "Paste or load a practice-question CSV first." }, 400);
  if (csvByteLength(rawCsv) > PRACTICE_QUESTION_CSV_MAX_BYTES) {
    return json({ ok: false, error: "The CSV is too large. The limit is 512 KB." }, 413);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase && !isDemoMode()) {
    return json({
      ok: false,
      error: "Practice-question imports are unavailable because SUPABASE_SERVICE_ROLE_KEY is missing.",
    }, 503);
  }
  let currentMax = -1;
  if (supabase) {
    const [testResult, maxResult] = await Promise.all([
      supabase.from("library_items").select("id,title").eq("id", testId).eq("kind", "test").maybeSingle(),
      supabase.from("practice_test_questions").select("position").eq("test_id", testId).order("position", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (testResult.error) return json({ ok: false, error: testResult.error.message }, 500);
    if (!testResult.data) return json({ ok: false, error: "That practice test no longer exists." }, 404);
    if (maxResult.error) return json({ ok: false, error: maxResult.error.message }, 500);
    currentMax = maxResult.data ? Number(maxResult.data.position) : -1;
  }

  // Parse every request, including commits, so a client cannot bypass the CSV
  // validation by changing a previously previewed payload.
  const parsed = parsePracticeQuestionCsv(rawCsv, { maxRows: PRACTICE_QUESTION_CSV_MAX_ROWS });
  const preview = previewFrom(parsed, currentMax);
  if (!commit) {
    return json({
      ok: true,
      preview,
      message: preview.canImport
        ? `${preview.rowCount} question${preview.rowCount === 1 ? "" : "s"} parsed. Review the preview, then import the entire batch.`
        : `Fix ${preview.errors.length} validation error${preview.errors.length === 1 ? "" : "s"} before importing.`,
    });
  }
  if (!preview.canImport) {
    return json({
      ok: false,
      preview,
      error: `Import blocked: fix all ${preview.errors.length} validation error${preview.errors.length === 1 ? "" : "s"}. No questions were added.`,
    }, 422);
  }

  const now = new Date().toISOString();
  if (!supabase) {
    const questions = preview.rows.map((row, index) => practiceQuestionFromRow({
      id: Date.now() + index,
      test_id: testId,
      question_type: row.type,
      prompt: row.prompt,
      options: row.options,
      correct_option: row.correctOption ?? null,
      model_answer: row.modelAnswer ?? null,
      explanation: row.explanation ?? null,
      points: row.points,
      position: row.position,
      is_active: true,
      created_at: now,
      updated_at: now,
    }));
    return json({
      ok: true,
      persisted: false,
      preview,
      questions,
      message: `Demo mode: ${questions.length} question${questions.length === 1 ? "" : "s"} imported for this session.`,
    });
  }

  const questionRows = preview.rows.map((row) => ({
    question_type: row.type,
    prompt: row.prompt,
    options: row.options,
    correct_option: row.correctOption ?? null,
    model_answer: row.modelAnswer ?? null,
    explanation: row.explanation ?? null,
    points: row.points,
    position: row.position,
  }));
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { data, error } = await supabase.rpc("import_practice_question_batch", {
    target_test_id: testId,
    actor_student_id: auth.currentUser.id,
    question_rows: questionRows,
    request_ip: ipAddress,
  });
  const importedRows = Array.isArray(data) ? data as Array<Record<string, unknown>> : null;
  if (error || !importedRows || importedRows.length !== questionRows.length) {
    return json({
      ok: false,
      preview,
      error: error?.message ?? "The full question batch could not be saved. No questions were added.",
    }, 500);
  }

  const questions = importedRows
    .map((row) => practiceQuestionFromRow(row))
    .sort((left, right) => left.position - right.position || left.id - right.id);
  return json({
    ok: true,
    preview,
    questions,
    message: `${questions.length} question${questions.length === 1 ? "" : "s"} imported.`,
  });
}
