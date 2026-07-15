"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardCopy, Download, FileSpreadsheet, Loader2, Pencil, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { PRACTICE_QUESTION_CSV_MAX_BYTES, PRACTICE_QUESTION_CSV_TEMPLATE } from "@/lib/practice-question-csv";
import type { PracticeQuestionCsvImportResponse, PracticeQuestionCsvPreview, PracticeQuestionMutationResponse, PracticeQuestionType, PracticeTestQuestion } from "@/lib/practice-types";
import { cn } from "@/lib/utils";

interface TestInfo {
  id: number;
  title: string;
  eventName: string;
  eventSlug: string;
}

interface FormState {
  id?: number;
  type: PracticeQuestionType;
  prompt: string;
  options: string[];
  correctOption: number;
  modelAnswer: string;
  explanation: string;
  points: number;
  position: number;
  isActive: boolean;
  updatedAt?: string;
}

function blank(position: number): FormState {
  return { type: "mcq", prompt: "", options: ["", "", "", ""], correctOption: 0, modelAnswer: "", explanation: "", points: 1, position, isActive: true };
}

function fromQuestion(question: PracticeTestQuestion): FormState {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: question.type === "mcq" ? question.options : ["", "", "", ""],
    correctOption: question.correctOption ?? 0,
    modelAnswer: question.modelAnswer ?? "",
    explanation: question.explanation ?? "",
    points: question.points,
    position: question.position,
    isActive: question.isActive,
    updatedAt: question.updatedAt,
  };
}

function requestBody(testId: number, form: FormState) {
  return { id: form.id, testId, type: form.type, prompt: form.prompt, options: form.type === "mcq" ? form.options : [], correctOption: form.type === "mcq" ? form.correctOption : undefined, modelAnswer: form.type === "frq" ? form.modelAnswer : undefined, explanation: form.explanation, points: form.points, position: form.position, isActive: form.isActive, updatedAt: form.updatedAt };
}

export function PracticeQuestionManager({ test, initialQuestions }: { test: TestInfo; initialQuestions: PracticeTestQuestion[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const nextPosition = useMemo(() => Math.max(-1, ...questions.map((question) => question.position)) + 1, [questions]);
  const [form, setForm] = useState<FormState>(() => blank(Math.max(-1, ...initialQuestions.map((question) => question.position)) + 1));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState("");
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [csvPreview, setCsvPreview] = useState<PracticeQuestionCsvPreview | null>(null);
  const [previewCsv, setPreviewCsv] = useState<string | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const [csvMessage, setCsvMessage] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvSourceRevision = useRef(0);
  const [isPending, startTransition] = useTransition();
  const [isCsvPending, startCsvTransition] = useTransition();
  const [csvPendingAction, setCsvPendingAction] = useState<"sheet" | "preview" | "import" | null>(null);

  function reset() {
    setForm(blank(nextPosition));
    setError(null);
  }

  function updateOption(index: number, value: string) {
    setForm((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? value : option) }));
  }

  function persist(next: FormState) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/practice-questions", { method: next.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(requestBody(test.id, next)) });
        const payload = await response.json() as PracticeQuestionMutationResponse;
        if (!response.ok || !payload.ok || !payload.question) throw new Error(payload.error ?? "Could not save this question.");
        setQuestions((current) => next.id ? current.map((question) => question.id === payload.question?.id ? payload.question : question) : [...current, payload.question!]);
        setMessage(payload.message ?? "Question saved.");
        setForm(blank(Math.max(nextPosition, payload.question.position + 1)));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not save this question.");
      }
    });
  }

  function remove(question: PracticeTestQuestion) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/practice-questions", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: question.id, updatedAt: question.updatedAt }) });
        const payload = await response.json() as PracticeQuestionMutationResponse;
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not remove this question.");
        setQuestions((current) => current.map((entry) => entry.id === question.id ? payload.question ?? { ...entry, isActive: false, updatedAt: new Date().toISOString() } : entry));
        if (form.id === question.id) reset();
        setMessage(payload.message ?? "Question removed.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not remove this question.");
      }
    });
  }

  function updateCsvInput(value: string, nextMessage: string | null = null) {
    csvSourceRevision.current += 1;
    setCsvInput(value);
    setGoogleSheetUrl("");
    setCsvPreview(null);
    setPreviewCsv(null);
    setPreviewFingerprint(null);
    setCsvMessage(nextMessage);
    setCsvError(null);
  }

  function loadCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const requestRevision = csvSourceRevision.current + 1;
    csvSourceRevision.current = requestRevision;
    setCsvInput("");
    setGoogleSheetUrl("");
    setCsvPreview(null);
    setPreviewCsv(null);
    setPreviewFingerprint(null);
    setCsvMessage(null);
    setCsvError(null);
    if (file.size > PRACTICE_QUESTION_CSV_MAX_BYTES) {
      setCsvError("The CSV is too large. The limit is 512 KB.");
      input.value = "";
      return;
    }
    void file.text()
      .then((text) => {
        if (csvSourceRevision.current !== requestRevision) return;
        setCsvInput(text);
        setCsvMessage(`${file.name} loaded. Select Parse preview to validate it.`);
      })
      .catch(() => {
        if (csvSourceRevision.current === requestRevision) setCsvError("Could not read that CSV file.");
      })
      .finally(() => { input.value = ""; });
  }

  function updateGoogleSheetUrl(value: string) {
    csvSourceRevision.current += 1;
    setGoogleSheetUrl(value);
    setCsvInput("");
    setCsvPreview(null);
    setPreviewCsv(null);
    setPreviewFingerprint(null);
    setCsvMessage(null);
    setCsvError(null);
  }

  function parseCsv(commit = false, sheetUrl = "") {
    const requestRevision = csvSourceRevision.current;
    const frozenCsv = commit ? previewCsv : null;
    const fingerprint = commit ? previewFingerprint : null;
    const sourceCsv = frozenCsv ?? csvInput;
    setCsvMessage(null);
    setCsvError(null);
    setCsvPendingAction(sheetUrl ? "sheet" : commit ? "import" : "preview");
    if (!commit) {
      setCsvPreview(null);
      setPreviewCsv(null);
      setPreviewFingerprint(null);
    }
    startCsvTransition(async () => {
      try {
        const response = await fetch("/api/admin/practice-questions/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(sheetUrl
            ? { testId: test.id, googleSheetUrl: sheetUrl, commit: false }
            : { testId: test.id, rawCsv: sourceCsv, previewFingerprint: fingerprint, commit }),
        });
        const payload = await response.json().catch(() => null) as PracticeQuestionCsvImportResponse | null;
        if (csvSourceRevision.current !== requestRevision) return;
        if (payload?.preview) setCsvPreview(payload.preview);
        if (commit && response.status === 409) {
          setPreviewCsv(null);
          setPreviewFingerprint(null);
        }
        if (!response.ok || !payload?.ok) throw new Error(payload?.error ?? "Could not parse the practice-question CSV.");
        if (!commit) {
          const resolvedCsv = payload.resolvedCsv ?? sourceCsv;
          if (typeof payload.resolvedCsv === "string") {
            setCsvInput(payload.resolvedCsv);
            setGoogleSheetUrl("");
          }
          setPreviewCsv(resolvedCsv);
          setPreviewFingerprint(payload.previewFingerprint ?? null);
        }
        setCsvMessage(payload.message ?? (commit ? "Questions imported." : "Preview ready."));
        if (commit) {
          const imported = payload.questions ?? [];
          setQuestions((current) => [...current, ...imported]);
          setForm((current) => current.id ? current : blank(Math.max(nextPosition, ...imported.map((question) => question.position + 1))));
          setCsvInput("");
          setGoogleSheetUrl("");
          setCsvPreview(null);
          setPreviewCsv(null);
          setPreviewFingerprint(null);
          csvSourceRevision.current += 1;
        }
      } catch (caught) {
        if (csvSourceRevision.current !== requestRevision) return;
        setCsvError(caught instanceof Error ? caught.message : "Could not import the practice-question CSV.");
      } finally {
        setCsvPendingAction(null);
      }
    });
  }

  async function copyCsvTemplate() {
    try {
      await navigator.clipboard.writeText(PRACTICE_QUESTION_CSV_TEMPLATE);
      setCsvMessage("Sample CSV copied to your clipboard.");
      setCsvError(null);
    } catch {
      updateCsvInput(PRACTICE_QUESTION_CSV_TEMPLATE, "Clipboard access was unavailable, so the sample was loaded into the editor.");
    }
  }

  function downloadCsvTemplate() {
    const url = URL.createObjectURL(new Blob([PRACTICE_QUESTION_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "practice-question-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setCsvMessage("Sample CSV downloaded.");
    setCsvError(null);
  }

  const ordered = [...questions].sort((left, right) => left.position - right.position || left.id - right.id);

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/library" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-cyan-300 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to library</Link>
        <Link href={`/practice/tests/${test.id}`} className="inline-flex min-h-11 items-center rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">Preview test</Link>
      </div>

      <section className="min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel" aria-labelledby="spreadsheet-import-heading" aria-busy={isCsvPending || undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-court-line p-4 sm:p-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-cyan-300"><FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> Spreadsheet question import</div>
            <h2 id="spreadsheet-import-heading" className="mt-1 text-xl font-semibold text-white">Add a full test from a spreadsheet</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">Load a public Google Sheet, upload a CSV, or paste CSV content, then review every parsed row. Imports are all-or-nothing: any row error blocks the entire batch.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyCsvTemplate()} disabled={isCsvPending} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-court-line px-3 text-xs font-medium text-zinc-600 hover:border-cyan-400 hover:text-white disabled:opacity-60"><ClipboardCopy className="h-3.5 w-3.5" /> Copy sample</button>
            <button type="button" onClick={downloadCsvTemplate} disabled={isCsvPending} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-court-line px-3 text-xs font-medium text-zinc-600 hover:border-cyan-400 hover:text-white disabled:opacity-60"><Download className="h-3.5 w-3.5" /> Download sample</button>
          </div>
        </div>

        <div className="grid min-w-0 gap-5 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)] sm:p-5">
          <div className="min-w-0 space-y-3">
            <div className="rounded-md border border-court-line bg-court-elevated p-3">
              <label htmlFor="google-sheet-url" className="text-xs font-medium uppercase tracking-wide text-zinc-500">Google Sheets link</label>
              <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  id="google-sheet-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  value={googleSheetUrl}
                  onChange={(event) => updateGoogleSheetUrl(event.target.value)}
                  disabled={isCsvPending}
                  placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
                  aria-describedby="google-sheet-help"
                  className="h-11 min-w-0 rounded-md border border-court-control bg-court-panel px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => parseCsv(false, googleSheetUrl.trim())}
                  disabled={isCsvPending || !googleSheetUrl.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-400/50 px-4 text-sm font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-black disabled:border-court-line disabled:bg-court-panel disabled:text-zinc-500"
                >
                  {csvPendingAction === "sheet" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                  {csvPendingAction === "sheet" ? "Loading Sheet…" : "Load & parse Sheet"}
                </button>
              </div>
              <p id="google-sheet-help" className="mt-2 text-xs leading-5 text-zinc-500">
                In Google Sheets, set General access to Anyone with the link — Viewer, then copy the URL while the question tab is selected. A fixed CSV snapshot is loaded for review.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="practice-question-csv" className="text-xs font-medium uppercase tracking-wide text-zinc-500">CSV source or loaded snapshot</label>
              <label className={cn("inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-court-control px-3 text-xs font-medium text-cyan-300 hover:border-cyan-400", isCsvPending && "pointer-events-none opacity-60")}><FileSpreadsheet className="h-3.5 w-3.5" /> Load .csv<input type="file" accept=".csv,text/csv" onChange={loadCsvFile} disabled={isCsvPending} className="sr-only" /></label>
            </div>
            <textarea
              id="practice-question-csv"
              rows={13}
              spellCheck={false}
              value={csvInput}
              onChange={(event) => updateCsvInput(event.target.value)}
              disabled={isCsvPending}
              aria-describedby="practice-question-csv-help"
              placeholder="Type,Question,Option A,Option B,Option C,Option D,Option E,Option F,Correct Answer,Model Answer,Explanation,Points,Order"
              className="w-full resize-y rounded-md border border-court-control bg-court-elevated p-3 font-mono text-xs leading-5 text-white outline-none placeholder:text-zinc-500 focus:border-cyan-400"
            />
            <p id="practice-question-csv-help" className="text-xs leading-5 text-zinc-500">Correct Answer accepts A–F, 1–6, or the exact choice text. Leave Order blank to append the question after the current maximum. Maximum 500 rows / 512 KB.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => parseCsv(false)} disabled={isCsvPending || !csvInput.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500">{csvPendingAction === "preview" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />} {csvPendingAction === "preview" ? "Parsing preview…" : "Parse preview"}</button>
              <button type="button" onClick={() => parseCsv(true)} disabled={isCsvPending || !csvPreview?.canImport || !previewCsv || !previewFingerprint} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-400/50 px-4 text-sm font-semibold text-cyan-200 hover:bg-cyan-400 hover:text-black disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500">{csvPendingAction === "import" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />} {csvPendingAction === "import" ? "Importing…" : "Import all questions"}</button>
            </div>
            {csvMessage ? <p role="status" className={cn("rounded-md border p-3 text-sm", csvPreview && !csvPreview.canImport ? "border-amber-300/30 bg-amber-300/10 text-amber-200" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-300")}>{csvMessage}</p> : null}
            {csvError ? <p role="alert" className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300">{csvError}</p> : null}
          </div>

          <div className="min-w-0 rounded-md border border-court-line bg-court-elevated p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Parse preview</p><h3 id="csv-preview-heading" className="mt-1 font-semibold text-white">{csvPreview ? `${csvPreview.rowCount} row${csvPreview.rowCount === 1 ? "" : "s"} detected` : "Nothing parsed yet"}</h3></div>
              {csvPreview ? <span className={cn("rounded-full px-2 py-1 text-xs", csvPreview.canImport ? "bg-emerald-300/10 text-emerald-300" : "bg-red-300/10 text-red-300")}>{csvPreview.canImport ? "Ready" : "Blocked"}</span> : null}
            </div>
            {csvPreview ? (
              <div className="mt-4 space-y-3">
                {csvPreview.errors.length > 0 ? (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1" role="alert" tabIndex={0} aria-labelledby="csv-preview-heading">
                    {csvPreview.errors.slice(0, 100).map((entry, index) => <div key={`${entry.row}-${entry.field ?? "row"}-${index}`} className="rounded-md border border-red-300/30 bg-red-300/5 p-3 text-xs leading-5 text-red-200"><span className="font-semibold">Row {entry.row}{entry.field ? ` · ${entry.field}` : ""}:</span> {entry.message}</div>)}
                    {csvPreview.errors.length > 100 ? <p className="text-xs text-red-200">Showing the first 100 of {csvPreview.errors.length} errors.</p> : null}
                  </div>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1" role="region" tabIndex={0} aria-labelledby="csv-preview-heading">
                    {csvPreview.rows.map((row) => <article key={row.sourceRow} className="rounded-md border border-court-line bg-court-panel p-3"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-cyan-300">Row {row.sourceRow} · {row.type.toUpperCase()}</span><span className="text-zinc-500">Order {row.position} · {row.points} pt{row.points === 1 ? "" : "s"}</span></div><p className="mt-2 line-clamp-2 break-words text-sm font-medium text-white">{row.prompt}</p>{row.type === "mcq" ? <p className="mt-1 text-xs text-emerald-300">Correct: {String.fromCharCode(65 + (row.correctOption ?? 0))}. {row.options[row.correctOption ?? 0]}</p> : <p className="mt-1 line-clamp-2 text-xs text-zinc-500">Model: {row.modelAnswer}</p>}</article>)}
                  </div>
                )}
              </div>
            ) : <p className="mt-3 text-sm leading-6 text-zinc-500">Select Parse preview after loading or pasting CSV data. The server reparses the same source again when you import.</p>}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-md border border-court-line bg-court-panel p-4 sm:p-5" aria-labelledby="question-editor-heading">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-medium text-cyan-300">{test.eventName}</p><h2 id="question-editor-heading" className="mt-1 text-xl font-semibold text-white">{form.id ? "Edit question" : "Add a question"}</h2></div>
            {form.id ? <button type="button" onClick={reset} className="grid h-11 w-11 place-items-center rounded-md border border-court-line text-zinc-500 hover:text-white" aria-label="Cancel editing"><X className="h-4 w-4" /></button> : null}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); persist(form); }} aria-busy={isPending || undefined}>
          <div className="mt-5 grid min-w-0 gap-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Question type">
              {(["mcq", "frq"] as const).map((type) => <button key={type} type="button" onClick={() => setForm((current) => ({ ...current, type }))} aria-pressed={form.type === type} className={cn("min-h-11 rounded-md border px-3 text-sm font-semibold", form.type === type ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-court-line text-zinc-500")}>{type === "mcq" ? "Multiple choice" : "Free response"}</button>)}
            </div>
            <label className="grid gap-2 text-sm font-medium text-zinc-600">Question<textarea required rows={5} maxLength={8000} value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} className="min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" /></label>

            {form.type === "mcq" ? (
              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium text-zinc-600">Choices <span className="font-normal text-zinc-500">(select the correct one)</span></legend>
                {form.options.map((option, index) => (
                  <div key={index} className="flex min-w-0 items-center gap-2">
                    <input type="radio" name="correct-option" checked={form.correctOption === index} onChange={() => setForm({ ...form, correctOption: index })} className="h-4 w-4 shrink-0 accent-cyan-400" aria-label={`Mark choice ${index + 1} correct`} />
                    <input required value={option} maxLength={1000} onChange={(event) => updateOption(index, event.target.value)} placeholder={`Choice ${index + 1}`} className="h-11 min-w-0 flex-1 rounded-md border border-court-control bg-court-panel px-3 text-white outline-none focus:border-cyan-400" />
                    {form.options.length > 2 ? <button type="button" onClick={() => setForm((current) => ({ ...current, options: current.options.filter((_, optionIndex) => optionIndex !== index), correctOption: current.correctOption === index ? 0 : current.correctOption > index ? current.correctOption - 1 : current.correctOption }))} className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-red-300 hover:bg-red-300/10" aria-label={`Remove choice ${index + 1}`}><Trash2 className="h-4 w-4" /></button> : null}
                  </div>
                ))}
                {form.options.length < 6 ? <button type="button" onClick={() => setForm({ ...form, options: [...form.options, ""] })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-dashed border-court-control text-sm font-medium text-cyan-300"><Plus className="h-4 w-4" /> Add choice</button> : null}
              </fieldset>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-zinc-600">Model answer<textarea required rows={6} maxLength={12000} value={form.modelAnswer} onChange={(event) => setForm({ ...form, modelAnswer: event.target.value })} placeholder="A strong answer members can compare with their response after submitting" className="min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" /></label>
            )}

            <label className="grid gap-2 text-sm font-medium text-zinc-600">Explanation <span className="font-normal text-zinc-500">(shown after submission)</span><textarea rows={4} maxLength={12000} value={form.explanation} onChange={(event) => setForm({ ...form, explanation: event.target.value })} className="min-w-0 resize-y rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-zinc-600">Points<input type="number" min={1} max={100} value={form.points} onChange={(event) => setForm({ ...form, points: Number(event.target.value) })} className="h-11 rounded-md border border-court-control bg-court-panel px-3 text-white" /></label>
              <label className="grid gap-2 text-sm font-medium text-zinc-600">Order<input type="number" min={0} max={1000} value={form.position} onChange={(event) => setForm({ ...form, position: Number(event.target.value) })} className="h-11 rounded-md border border-court-control bg-court-panel px-3 text-white" /></label>
            </div>
          </div>

          <button type="submit" disabled={isPending || !form.prompt.trim() || (form.type === "frq" && !form.modelAnswer.trim()) || (form.type === "mcq" && form.options.some((option) => !option.trim()))} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500">{isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : form.id ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}{isPending ? "Saving question…" : form.id ? "Save question" : "Add question"}</button>
          </form>
          {message ? <p role="status" className="mt-3 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-300">{message}</p> : null}
          {error ? <p role="alert" className="mt-3 rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300">{error}</p> : null}
        </section>

        <section className="min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel">
          <div className="border-b border-court-line p-4 sm:p-5"><h2 id="test-questions-heading" className="text-xl font-semibold text-white">{test.title}</h2><p className="mt-1 text-sm text-zinc-500">{ordered.filter((question) => question.isActive).length} active questions · MCQs score automatically; free responses use model-answer self-review.</p></div>
          <div className="grid gap-3 p-4 sm:p-5">
            {ordered.map((question, index) => (
              <article key={question.id} className={cn("min-w-0 rounded-md border p-4", question.isActive ? "border-court-line bg-court-elevated" : "border-red-300/30 bg-red-300/5")}>
                <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium uppercase text-cyan-300">Question {index + 1} · {question.type.toUpperCase()} · {question.points} pt{question.points === 1 ? "" : "s"}</p><h3 className="mt-2 break-words font-semibold leading-6 text-white">{question.prompt}</h3></div><span className={cn("shrink-0 rounded-full px-2 py-1 text-xs", question.isActive ? "bg-emerald-300/10 text-emerald-300" : "bg-red-300/10 text-red-300")}>{question.isActive ? "Active" : "Removed"}</span></div>
                {question.type === "mcq" ? <div className="mt-3 grid gap-1 text-sm text-zinc-500">{question.options.map((option, optionIndex) => <div key={optionIndex} className={cn("flex gap-2", optionIndex === question.correctOption && "text-emerald-300")}><span>{String.fromCharCode(65 + optionIndex)}.</span><span className="break-words">{option}</span>{optionIndex === question.correctOption ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}</div>)}</div> : <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-500">Model: {question.modelAnswer}</p>}
                <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setForm(fromQuestion(question)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-court-line px-3 text-xs font-medium text-zinc-600 hover:border-cyan-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /> Edit</button>{question.isActive ? <button type="button" disabled={isPending} onClick={() => remove(question)} className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-medium text-red-300 hover:bg-red-300/10"><Trash2 className="h-3.5 w-3.5" /> Remove</button> : <button type="button" disabled={isPending} onClick={() => persist({ ...fromQuestion(question), isActive: true })} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-300/10 px-3 text-xs font-medium text-emerald-300"><RotateCcw className="h-3.5 w-3.5" /> Restore</button>}</div>
              </article>
            ))}
            {ordered.length === 0 ? <div className="rounded-md border border-dashed border-court-control px-5 py-12 text-center"><p className="font-medium text-white">No questions yet</p><p className="mt-1 text-sm text-zinc-500">Add the first MCQ or free-response question using the editor.</p></div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
