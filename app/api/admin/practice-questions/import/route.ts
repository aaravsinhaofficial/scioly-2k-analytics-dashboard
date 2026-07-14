import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getCurrentDemoUser } from "@/lib/analytics";
import { fetchPublicGoogleSheetCsv, GoogleSheetsCsvError } from "@/lib/google-sheets-csv";
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
  googleSheetUrl?: string;
  previewFingerprint?: string;
  commit?: boolean;
}

const IMPORT_REQUEST_MAX_BYTES = 4 * 1024 * 1024;

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

async function readImportRequest(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > IMPORT_REQUEST_MAX_BYTES) return null;
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    byteLength += value.byteLength;
    if (byteLength > IMPORT_REQUEST_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
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

function fingerprintPreview(testId: number, rawCsv: string, preview: PracticeQuestionCsvPreview) {
  return createHash("sha256")
    .update(JSON.stringify({ testId, rawCsv, preview }))
    .digest("base64url");
}

export async function POST(request: Request) {
  const auth = await officer();
  if (auth.response) return auth.response;

  const requestBody = await readImportRequest(request);
  if (requestBody === null) {
    return json({ ok: false, error: "The import request is too large." }, 413);
  }
  let body: ImportRequest | null = null;
  try {
    body = JSON.parse(requestBody) as ImportRequest;
  } catch {
    return json({ ok: false, error: "The import request is not valid JSON." }, 400);
  }
  const testId = Number(body?.testId);
  const suppliedRawCsv = typeof body?.rawCsv === "string" ? body.rawCsv : "";
  const googleSheetUrl = typeof body?.googleSheetUrl === "string" ? body.googleSheetUrl.trim() : "";
  const suppliedFingerprint = typeof body?.previewFingerprint === "string" ? body.previewFingerprint : "";
  const commit = body?.commit === true;
  if (!Number.isInteger(testId) || testId <= 0) {
    return json({ ok: false, error: "Choose a valid practice test." }, 400);
  }
  if (suppliedRawCsv.trim() && googleSheetUrl) {
    return json({ ok: false, error: "Choose either CSV content or a Google Sheets link, not both." }, 400);
  }
  if (!suppliedRawCsv.trim() && !googleSheetUrl) {
    return json({ ok: false, error: "Paste or load CSV content, or enter a public Google Sheets link." }, 400);
  }
  if (commit && googleSheetUrl) {
    return json({ ok: false, error: "Load and review the Google Sheet before importing its frozen CSV snapshot." }, 400);
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

  let rawCsv = suppliedRawCsv;
  let resolvedCsv: string | undefined;
  if (googleSheetUrl) {
    try {
      const googleSheet = await fetchPublicGoogleSheetCsv(googleSheetUrl, {
        maxBytes: PRACTICE_QUESTION_CSV_MAX_BYTES,
      });
      rawCsv = googleSheet.rawCsv;
      resolvedCsv = googleSheet.rawCsv;
    } catch (error) {
      if (error instanceof GoogleSheetsCsvError) {
        return json({ ok: false, error: error.message }, error.status);
      }
      return json({ ok: false, error: "Google Sheets could not be reached. Try again shortly." }, 502);
    }
  }
  if (csvByteLength(rawCsv) > PRACTICE_QUESTION_CSV_MAX_BYTES) {
    return json({ ok: false, error: "The CSV is too large. The limit is 512 KB." }, 413);
  }

  // Parse every request, including commits, so a client cannot bypass the CSV
  // validation by changing a previously previewed payload.
  const parsed = parsePracticeQuestionCsv(rawCsv, { maxRows: PRACTICE_QUESTION_CSV_MAX_ROWS });
  const preview = previewFrom(parsed, currentMax);
  const previewFingerprint = fingerprintPreview(testId, rawCsv, preview);
  if (!commit) {
    return json({
      ok: true,
      preview,
      resolvedCsv,
      previewFingerprint,
      message: preview.canImport
        ? `${preview.rowCount} question${preview.rowCount === 1 ? "" : "s"} ${googleSheetUrl ? "loaded from Google Sheets and " : ""}parsed. Review the preview, then import the entire batch.`
        : `Fix ${preview.errors.length} validation error${preview.errors.length === 1 ? "" : "s"} before importing.`,
    });
  }
  if (!suppliedFingerprint || suppliedFingerprint !== previewFingerprint) {
    return json({
      ok: false,
      preview,
      error: "The CSV or test changed since this preview. Parse it again before importing. No questions were added.",
    }, 409);
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
    expected_current_max: currentMax,
    request_ip: ipAddress,
  });
  const importedRows = Array.isArray(data) ? data as Array<Record<string, unknown>> : null;
  if (error?.message.includes("changed since this preview")) {
    return json({
      ok: false,
      preview,
      error: "The test changed since this preview. Parse it again before importing. No questions were added.",
    }, 409);
  }
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
