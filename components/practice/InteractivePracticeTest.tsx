"use client";

import { Check, ChevronLeft, ChevronRight, Loader2, Play, RotateCcw, Save, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FrqSelfReview, PracticeAnswerValue, PracticeAttemptResponse, PracticeAttemptSummary, PracticeAttemptView } from "@/lib/practice-types";
import { cn } from "@/lib/utils";

interface TestOverview {
  id: number;
  title: string;
  eventName: string;
  description?: string;
  format?: string;
  difficulty?: string;
  body?: string;
  url?: string;
  questionCount: number;
  totalPoints: number;
}

function answered(value: PracticeAnswerValue | undefined) {
  return typeof value === "number" || (typeof value === "string" && value.trim().length > 0);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function InteractivePracticeTest({ test }: { test: TestOverview }) {
  const [attempt, setAttempt] = useState<PracticeAttemptView | null>(null);
  const [history, setHistory] = useState<PracticeAttemptSummary[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const attemptRef = useRef<PracticeAttemptView | null>(null);
  const lastSavedAnswersRef = useRef("{}");
  const versionRef = useRef(1);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingSaveCount = useRef(0);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingViewFocusRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/practice/attempts?testId=${test.id}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PracticeAttemptResponse;
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not load your practice attempts.");
        if (!active) return;
        const loadedAttempt = payload.attempt ?? null;
        attemptRef.current = loadedAttempt;
        lastSavedAnswersRef.current = JSON.stringify(loadedAttempt?.answers ?? {});
        setAttempt(loadedAttempt);
        if (loadedAttempt) versionRef.current = loadedAttempt.version;
        setHistory(payload.history ?? []);
      })
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : "Could not load this test."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [test.id]);

  const queueSave = useCallback((current: PracticeAttemptView) => {
    if (current.status !== "in_progress") return Promise.resolve();
    const answerSnapshot = JSON.stringify(current.answers);
    if (answerSnapshot === lastSavedAnswersRef.current && pendingSaveCount.current === 0) return Promise.resolve();
    pendingSaveCount.current += 1;
    setSaving(true);
    const task = saveQueueRef.current.then(async () => {
      if (answerSnapshot === lastSavedAnswersRef.current) return;
      const response = await fetch("/api/practice/attempts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: current.id, version: versionRef.current, answers: current.answers }) });
      const payload = await response.json() as PracticeAttemptResponse;
      if (!response.ok || !payload.ok || !payload.attempt) throw new Error(payload.error ?? "Could not save your progress.");
      versionRef.current = payload.attempt.version;
      lastSavedAnswersRef.current = answerSnapshot;
      setAttempt((latest) => {
        if (latest?.id !== current.id || latest.status !== "in_progress") return latest;
        const next = { ...latest, version: payload.attempt!.version, updatedAt: payload.attempt!.updatedAt };
        attemptRef.current = next;
        return next;
      });
      setError(null);
    });
    saveQueueRef.current = task.catch(() => undefined);
    void task.catch((caught) => setError(caught instanceof Error ? caught.message : "Could not save your progress.")).finally(() => {
      pendingSaveCount.current -= 1;
      if (pendingSaveCount.current === 0) setSaving(false);
    });
    return task;
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const latest = attemptRef.current;
    if (latest?.status === "in_progress") void queueSave(latest).catch(() => undefined);
  }, [queueSave]);

  useEffect(() => {
    if (!pendingViewFocusRef.current) return;
    pendingViewFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      if (attempt) questionHeadingRef.current?.focus();
      else overviewHeadingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [attempt]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!attempt || attempt.status !== "in_progress") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void queueSave(attempt).catch(() => undefined), 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [attempt?.answers, attempt?.id, attempt?.status, queueSave]);

  async function start() {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch("/api/practice/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testId: test.id }) });
      const payload = await response.json() as PracticeAttemptResponse;
      if (!response.ok || !payload.ok || !payload.attempt) throw new Error(payload.error ?? "Could not start the test.");
      attemptRef.current = payload.attempt;
      lastSavedAnswersRef.current = JSON.stringify(payload.attempt.answers);
      pendingViewFocusRef.current = true;
      setAttempt(payload.attempt);
      versionRef.current = payload.attempt.version;
      setIndex(0);
      setMessage(payload.message ?? "Test started.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start the test.");
    } finally {
      setWorking(false);
    }
  }

  function setAnswer(questionId: number, value: PracticeAnswerValue) {
    if (working) return;
    setAttempt((current) => {
      if (!current || current.status !== "in_progress") return current;
      const next = { ...current, answers: { ...current.answers, [String(questionId)]: value } };
      attemptRef.current = next;
      return next;
    });
  }

  function goToQuestion(nextIndex: number) {
    setIndex(Math.max(0, Math.min((attemptRef.current?.questions.length ?? 1) - 1, nextIndex)));
    requestAnimationFrame(() => questionHeadingRef.current?.focus());
  }

  async function submit() {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || currentAttempt.status !== "in_progress") return;
    const missing = currentAttempt.questions.filter((question) => !answered(currentAttempt.answers[String(question.id)])).length;
    if (missing && !window.confirm(`${missing} question${missing === 1 ? " is" : "s are"} unanswered. Submit anyway?`)) return;
    setWorking(true);
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await queueSave(currentAttempt);
      const response = await fetch("/api/practice/attempts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: currentAttempt.id, version: versionRef.current, answers: currentAttempt.answers }) });
      const payload = await response.json() as PracticeAttemptResponse;
      if (!response.ok || !payload.ok || !payload.attempt) throw new Error(payload.error ?? "Could not submit the test.");
      attemptRef.current = payload.attempt;
      lastSavedAnswersRef.current = JSON.stringify(payload.attempt.answers);
      pendingViewFocusRef.current = true;
      setAttempt(payload.attempt);
      versionRef.current = payload.attempt.version;
      setIndex(0);
      setMessage(payload.message ?? "Test submitted.");
      setHistory((current) => [payload.attempt!, ...current.filter((entry) => entry.id !== payload.attempt?.id)]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit the test.");
    } finally {
      setWorking(false);
    }
  }

  async function review(questionId: number, value: FrqSelfReview) {
    if (!attempt) return;
    const reviews = { ...attempt.frqReviews, [String(questionId)]: value };
    setAttempt({ ...attempt, frqReviews: reviews });
    setSaving(true);
    try {
      const response = await fetch("/api/practice/attempts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: attempt.id, version: versionRef.current, action: "self_review", frqReviews: reviews }) });
      const payload = await response.json() as PracticeAttemptResponse;
      if (!response.ok || !payload.ok || !payload.attempt) throw new Error(payload.error ?? "Could not save self-review.");
      attemptRef.current = payload.attempt;
      setAttempt(payload.attempt);
      versionRef.current = payload.attempt.version;
      setHistory((current) => current.map((entry) => entry.id === payload.attempt?.id ? payload.attempt! : entry));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save self-review.");
    } finally {
      setSaving(false);
    }
  }

  async function openCompleted(attemptId: string) {
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/practice/attempts?attemptId=${encodeURIComponent(attemptId)}`, { cache: "no-store" });
      const payload = await response.json() as PracticeAttemptResponse;
      if (!response.ok || !payload.ok || !payload.attempt || payload.attempt.status !== "submitted") throw new Error(payload.error ?? "Could not open this completed attempt.");
      attemptRef.current = payload.attempt;
      lastSavedAnswersRef.current = JSON.stringify(payload.attempt.answers);
      pendingViewFocusRef.current = true;
      setAttempt(payload.attempt);
      versionRef.current = payload.attempt.version;
      setIndex(0);
      setMessage("Opened completed attempt.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this completed attempt.");
    } finally {
      setWorking(false);
    }
  }

  async function restart() {
    const currentAttempt = attemptRef.current;
    if (!currentAttempt || currentAttempt.status !== "in_progress") return;
    if (!window.confirm("Discard this open attempt and start again? Its answers will stay in attempt history, but it cannot be resumed.")) return;
    setWorking(true);
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await queueSave(currentAttempt);
      const discardResponse = await fetch("/api/practice/attempts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId: currentAttempt.id, version: versionRef.current }) });
      const discarded = await discardResponse.json() as PracticeAttemptResponse;
      if (!discardResponse.ok || !discarded.ok || !discarded.attempt) throw new Error(discarded.error ?? "Could not discard this attempt.");
      setHistory((current) => [discarded.attempt!, ...current.filter((entry) => entry.id !== discarded.attempt?.id)]);
      attemptRef.current = null;
      pendingViewFocusRef.current = true;
      setAttempt(null);
      versionRef.current = discarded.attempt.version;

      const startResponse = await fetch("/api/practice/attempts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ testId: test.id }) });
      const started = await startResponse.json() as PracticeAttemptResponse;
      if (!startResponse.ok || !started.ok || !started.attempt) throw new Error(started.error ?? "The old attempt was discarded, but a new one could not be started.");
      attemptRef.current = started.attempt;
      lastSavedAnswersRef.current = JSON.stringify(started.attempt.answers);
      pendingViewFocusRef.current = true;
      setAttempt(started.attempt);
      versionRef.current = started.attempt.version;
      setIndex(0);
      setMessage("Previous attempt kept in history. New attempt started.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restart the test.");
    } finally {
      setWorking(false);
    }
  }

  const question = attempt?.questions[index];
  const answeredCount = useMemo(() => attempt?.questions.filter((entry) => answered(attempt.answers[String(entry.id)])).length ?? 0, [attempt]);
  const reviewedFrqs = attempt?.questions.filter((entry) => entry.type === "frq" && attempt.frqReviews[String(entry.id)]).length ?? 0;
  const frqCount = attempt?.questions.filter((entry) => entry.type === "frq").length ?? 0;

  if (loading) return <div className="grid min-h-64 place-items-center rounded-md border border-court-line bg-court-panel" role="status"><div className="flex items-center gap-3 text-sm text-zinc-500"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" aria-hidden="true" />Loading practice test…</div></div>;

  if (!attempt) {
    return (
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-md border border-court-line bg-court-panel p-5 sm:p-6" aria-busy={working}>
          <div className="flex flex-wrap gap-2 text-xs font-medium"><span className="rounded-md bg-cyan-400/10 px-2 py-1 text-cyan-300">{test.format ?? "Practice test"}</span>{test.difficulty ? <span className="rounded-md border border-court-line px-2 py-1 text-zinc-500">{test.difficulty}</span> : null}</div>
          <h2 ref={overviewHeadingRef} tabIndex={-1} className="mt-4 text-2xl font-semibold text-white focus:outline-none">Ready to begin?</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{test.description ?? "Work through each question, then submit once. Your answers save as you go."}</p>
          {test.body ? <div className="mt-5 whitespace-pre-wrap break-words rounded-md border border-court-line bg-court-elevated p-4 text-sm leading-6 text-zinc-600">{test.body}</div> : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-court-line bg-court-elevated p-4"><div className="text-2xl font-semibold text-white">{test.questionCount}</div><div className="mt-1 text-sm text-zinc-500">Questions</div></div><div className="rounded-md border border-court-line bg-court-elevated p-4"><div className="text-2xl font-semibold text-white">{test.totalPoints}</div><div className="mt-1 text-sm text-zinc-500">Available points</div></div></div>
          <button type="button" onClick={start} disabled={working || test.questionCount === 0} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500">{working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />} {working ? "Starting test…" : test.questionCount ? "Start practice test" : "Questions have not been added yet"}</button>
          {test.url ? <a href={test.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-court-line text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">Open attached test file ↗</a> : null}
          {error ? <p className="mt-4 rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300" role="alert">{error}</p> : null}
        </section>
        <section className="rounded-md border border-court-line bg-court-panel p-5">
          <h2 className="text-lg font-semibold text-white">Your attempts</h2>
          <p className="sr-only" role="status" aria-live="polite">
            {history.filter((entry) => entry.status !== "in_progress").length} saved attempt{history.filter((entry) => entry.status !== "in_progress").length === 1 ? "" : "s"}.
          </p>
          <div className="mt-4 space-y-2">
            {history.filter((entry) => entry.status !== "in_progress").map((entry) => entry.status === "submitted" ? (
              <button key={entry.id} type="button" disabled={working} onClick={() => openCompleted(entry.id)} className="w-full rounded-md border border-court-line bg-court-elevated p-3 text-left transition hover:border-cyan-400">
                <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-white">{dateLabel(entry.submittedAt ?? entry.startedAt)}</span><span className="text-cyan-300">{entry.earnedPoints}/{entry.maxPoints} pts</span></div>
                <p className="mt-1 text-xs text-zinc-500">{entry.mcqCorrect}/{entry.mcqTotal} MCQ correct · Open review</p>
              </button>
            ) : (
              <div key={entry.id} className="rounded-md border border-court-line bg-court-elevated p-3">
                <div className="flex justify-between gap-3 text-sm"><span className="font-medium text-zinc-500">Discarded {dateLabel(entry.discardedAt ?? entry.startedAt)}</span><span className="text-xs text-zinc-500">History kept</span></div>
              </div>
            ))}
            {history.every((entry) => entry.status === "in_progress") ? <p className="text-sm leading-6 text-zinc-500">Completed and discarded attempts will appear here.</p> : null}
          </div>
        </section>
      </div>
    );
  }

  if (!question) return null;
  const response = attempt.answers[String(question.id)];
  const submitted = attempt.status === "submitted";
  const inputsLocked = submitted || working;

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel" aria-busy={working}>
      <div className="border-b border-court-line p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-cyan-300">{submitted ? "Review" : `${answeredCount} of ${attempt.questions.length} answered`}</p><h2 className="mt-1 text-xl font-semibold text-white">{attempt.testTitle}</h2></div><div className="flex flex-wrap items-center justify-end gap-3"><div className={cn("flex items-center gap-2 text-xs", error && !submitted ? "text-red-300" : "text-zinc-500")} role="status" aria-live="polite">{saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Saving</> : error && !submitted ? "Not saved" : submitted ? <><Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> Submitted</> : <><Save className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" /> Saved</>}</div>{!submitted ? <button type="button" disabled={working || saving} onClick={restart} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-300/30 px-3 text-xs font-medium text-red-300 hover:bg-red-300/10 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Start over</button> : null}</div></div>
        {submitted ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-court-elevated p-3"><div className="text-xl font-semibold text-white">{attempt.mcqCorrect}/{attempt.mcqTotal}</div><div className="text-xs text-zinc-500">MCQ correct</div></div><div className="rounded-md bg-court-elevated p-3"><div className="text-xl font-semibold text-white">{attempt.earnedPoints}/{attempt.maxPoints}</div><div className="text-xs text-zinc-500">Points after self-review</div></div><div className="rounded-md bg-court-elevated p-3"><div className="text-xl font-semibold text-white">{reviewedFrqs}/{frqCount}</div><div className="text-xs text-zinc-500">FRQs reviewed</div></div></div> : <div className="mt-4 h-2 overflow-hidden rounded-full bg-court-elevated" role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={attempt.questions.length} aria-valuenow={answeredCount} aria-valuetext={`${answeredCount} of ${attempt.questions.length} questions answered`}><div className="h-full bg-cyan-400 transition-all" style={{ width: `${attempt.questions.length ? (answeredCount / attempt.questions.length) * 100 : 0}%` }} /></div>}
      </div>

      <div className="grid min-w-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="border-b border-court-line p-4 lg:border-b-0 lg:border-r" aria-label="Test questions"><div className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-4">{attempt.questions.map((entry, questionIndex) => { const hasAnswer = answered(attempt.answers[String(entry.id)]); return <button key={entry.id} type="button" onClick={() => goToQuestion(questionIndex)} aria-label={`Question ${questionIndex + 1}${hasAnswer ? ", answered" : ", unanswered"}`} aria-current={questionIndex === index ? "step" : undefined} className={cn("grid aspect-square min-h-11 place-items-center rounded-md border text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400", questionIndex === index ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : hasAnswer ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-300" : "border-court-line text-zinc-500")}>{questionIndex + 1}</button>; })}</div></nav>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="text-xs font-medium uppercase text-cyan-300">Question {index + 1} of {attempt.questions.length} · {question.type === "mcq" ? "Multiple choice" : "Free response"} · {question.points} pt{question.points === 1 ? "" : "s"}</div>
          <h3 ref={questionHeadingRef} tabIndex={-1} id={`practice-question-${question.id}`} className="mt-3 whitespace-pre-wrap break-words text-lg font-semibold leading-7 text-white focus:outline-none">{question.prompt}</h3>

          {question.type === "mcq" ? <div className="mt-6 grid gap-3" role="group" aria-labelledby={`practice-question-${question.id}`}>{question.options.map((option, optionIndex) => { const chosen = response === optionIndex; const correct = submitted && optionIndex === question.correctOption; const wrong = submitted && chosen && !correct; return <button key={optionIndex} type="button" aria-pressed={chosen} disabled={inputsLocked} onClick={() => setAnswer(question.id, optionIndex)} className={cn("flex min-h-12 min-w-0 items-start gap-3 rounded-md border p-3 text-left text-sm leading-6 transition disabled:cursor-not-allowed", !submitted && chosen ? "border-cyan-400 bg-cyan-400/10 text-white" : "border-court-line bg-court-elevated text-zinc-600 hover:border-cyan-400", correct && "border-emerald-300 bg-emerald-300/10 text-emerald-300", wrong && "border-red-300 bg-red-300/10 text-red-300")}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-current text-xs font-semibold" aria-hidden="true">{String.fromCharCode(65 + optionIndex)}</span><span className="min-w-0 flex-1 break-words">{option}</span>{correct ? <span className="shrink-0 rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs font-semibold">Correct answer</span> : wrong ? <span className="shrink-0 rounded-full border border-red-300/40 px-2 py-0.5 text-xs font-semibold">Your answer</span> : null}</button>; })}</div> : <div className="mt-6"><label className="grid gap-2 text-sm font-medium text-zinc-600">Your response<textarea disabled={inputsLocked} rows={10} maxLength={20000} value={typeof response === "string" ? response : ""} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder="Write your answer here…" aria-describedby={`practice-question-${question.id}`} className="min-w-0 resize-y rounded-md border border-court-control bg-court-elevated p-4 text-base text-white outline-none focus:border-cyan-400 disabled:opacity-100" /></label></div>}

          {submitted ? <div className="mt-6 space-y-4 border-t border-court-line pt-5">{question.type === "mcq" ? <div role="status" className={cn("rounded-md border p-4 text-sm font-medium", question.isCorrect ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" : "border-red-300/30 bg-red-300/10 text-red-300")}>{question.isCorrect ? "Correct" : `Not correct. Correct answer: ${question.options[question.correctOption ?? -1] ?? "See the labeled option above"}.`}</div> : <><div className="rounded-md border border-cyan-400/30 bg-cyan-400/10 p-4"><div className="text-sm font-semibold text-cyan-300">Model answer</div><div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{question.modelAnswer}</div></div><div><div id={`practice-review-${question.id}`} className="text-sm font-semibold text-white">How did your response compare?</div>{answered(response) ? <div className="mt-2 grid gap-2 sm:grid-cols-3" role="group" aria-labelledby={`practice-review-${question.id}`}>{(["correct", "partial", "incorrect"] as const).map((rating) => <button key={rating} type="button" disabled={saving} aria-pressed={attempt.frqReviews[String(question.id)] === rating} onClick={() => review(question.id, rating)} className={cn("min-h-11 rounded-md border px-3 text-sm font-medium capitalize", attempt.frqReviews[String(question.id)] === rating ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-court-line text-zinc-500 hover:text-white")}>{rating === "correct" ? "Matched well" : rating === "partial" ? "Partly matched" : "Needs work"}</button>)}</div> : <p className="mt-2 text-sm text-zinc-500">No response was submitted, so this question does not receive self-review points.</p>}</div></>}{question.explanation ? <div className="rounded-md border border-court-line bg-court-elevated p-4"><div className="text-sm font-semibold text-white">Explanation</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-600">{question.explanation}</p></div> : null}</div> : null}

          <div className="mt-7 flex flex-col-reverse gap-2 border-t border-court-line pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" disabled={index === 0} onClick={() => goToQuestion(index - 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 hover:text-white disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous</button>{index < attempt.questions.length - 1 ? <button type="button" onClick={() => goToQuestion(index + 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">Next <ChevronRight className="h-4 w-4" aria-hidden="true" /></button> : submitted ? <button type="button" disabled={saving || working} onClick={() => { attemptRef.current = null; pendingViewFocusRef.current = true; setAttempt(null); setIndex(0); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Finish review</button> : <button type="button" disabled={working || saving} onClick={submit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:opacity-60">{working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} {working ? "Submitting…" : "Submit test"}</button>}</div>
          {message ? <p className="mt-4 text-sm text-emerald-300" role="status">{message}</p> : null}{error ? <p className="mt-4 rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300" role="alert">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
