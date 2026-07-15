"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, PlusCircle, RotateCw, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { activityLabels } from "@/lib/activity";
import type { ActivityType, PlayerDetail, PointLogStatus } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

interface AdminPointRow {
  id: number;
  studentId: string;
  studentName: string;
  activityType: ActivityType;
  activity: string;
  customLabel: string | null;
  points: number;
  minutes: number;
  quantity: number | null;
  status: PointLogStatus;
  submittedAt: string;
  notes: string | null;
}

interface EditDraft {
  id: number;
  studentId: string;
  activityType: ActivityType;
  customLabel: string;
  points: string;
  minutes: string;
  quantity: string;
  status: PointLogStatus;
  submittedAt: string;
  notes: string;
  reason: string;
}

const activityOptions = Object.entries(activityLabels) as Array<[ActivityType, string]>;

function toLocalDateTime(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

function editDraftFor(row: AdminPointRow): EditDraft {
  return {
    id: row.id,
    studentId: row.studentId,
    activityType: row.activityType,
    customLabel: row.customLabel ?? (row.activityType === "custom_activity" ? row.activity : ""),
    points: String(row.points),
    minutes: String(row.minutes),
    quantity: row.quantity === null ? "" : String(row.quantity),
    status: row.status,
    submittedAt: toLocalDateTime(row.submittedAt),
    notes: row.notes ?? "",
    reason: ""
  };
}

export function AdminPointManager({ students, initialPointId }: { students: PlayerDetail[]; initialPointId?: number }) {
  const router = useRouter();
  const sortedStudents = useMemo(
    () => [...students].sort((left, right) => left.name.localeCompare(right.name)),
    [students]
  );
  const [studentId, setStudentId] = useState(sortedStudents[0]?.id ?? "");
  const [points, setPoints] = useState(50);
  const [minutes, setMinutes] = useState(0);
  const [label, setLabel] = useState("Admin adjustment");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<AdminPointRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | PointLogStatus>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openedInitialPoint = useRef(false);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const editReturnIdRef = useRef<number | null>(null);

  function focusEditor() {
    window.requestAnimationFrame(() => {
      editorHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      editorHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  function focusEditTrigger(id: number | null) {
    window.requestAnimationFrame(() => {
      const candidates = id === null
        ? []
        : Array.from(document.querySelectorAll<HTMLElement>(`[data-point-edit-id="${id}"]`));
      const visible = candidates.find((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
      (visible ?? document.getElementById("point-records-heading"))?.focus();
    });
  }

  function closeEditor() {
    const returnId = editReturnIdRef.current;
    editReturnIdRef.current = null;
    setEditing(null);
    focusEditTrigger(returnId);
  }

  async function loadRows() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/points?limit=300", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; rows?: AdminPointRow[]; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not load point records.");
      let nextRows = payload.rows ?? [];
      if (!openedInitialPoint.current && initialPointId && !nextRows.some((row) => row.id === initialPointId)) {
        const focusedResponse = await fetch(`/api/admin/points?id=${initialPointId}`, { cache: "no-store" });
        const focusedPayload = await focusedResponse.json() as { ok?: boolean; rows?: AdminPointRow[]; error?: string };
        if (focusedResponse.ok && focusedPayload.ok && focusedPayload.rows?.[0]) {
          nextRows = [focusedPayload.rows[0], ...nextRows];
        }
      }
      setRows(nextRows);
      if (!openedInitialPoint.current && initialPointId) {
        openedInitialPoint.current = true;
        const focusedRow = nextRows.find((row) => row.id === initialPointId);
        if (focusedRow) {
          editReturnIdRef.current = null;
          setEditing(editDraftFor(focusedRow));
          focusEditor();
        } else {
          setError(`Point log #${initialPointId} could not be found.`);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load point records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = status === "all" || row.status === status;
      const matchesQuery = !normalized || `${row.studentName} ${row.activity} ${row.notes ?? ""}`.toLowerCase().includes(normalized);
      return matchesStatus && matchesQuery;
    });
  }, [query, rows, status]);

  async function addPoints() {
    if (
      saving ||
      !studentId ||
      !label.trim() ||
      !reason.trim() ||
      !Number.isInteger(points) ||
      points < 1 ||
      points > 500 ||
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > 240
    ) {
      setError("Complete every required field with a valid value before adding points.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/points", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId, points, minutes, label, reason })
      });
      const payload = await response.json() as { ok?: boolean; row?: AdminPointRow; message?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not add points.");
      if (payload.row) setRows((current) => [payload.row!, ...current]);
      setMessage(payload.message ?? "Points added.");
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add points.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(row: AdminPointRow) {
    editReturnIdRef.current = row.id;
    setEditing(editDraftFor(row));
    setConfirmingId(null);
    setMessage(null);
    setError(null);
    focusEditor();
  }

  async function saveEdit() {
    if (!editing) return;
    if (editInvalid) {
      setError("Complete the required point details and audit reason before saving.");
      return;
    }
    setSavingEdit(true);
    setMessage(null);
    setError(null);
    try {
      const submitted = new Date(editing.submittedAt);
      if (!Number.isFinite(submitted.getTime())) throw new Error("Enter a valid submission date and time.");
      const response = await fetch("/api/admin/points", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "edit",
          id: editing.id,
          studentId: editing.studentId,
          activityType: editing.activityType,
          customLabel: editing.activityType === "custom_activity" ? editing.customLabel : null,
          points: Number(editing.points),
          minutes: Number(editing.minutes),
          quantity: editing.activityType === "id_specimens" && editing.quantity.trim() !== ""
            ? Number(editing.quantity)
            : null,
          status: editing.status,
          submittedAt: submitted.toISOString(),
          notes: editing.notes,
          reason: editing.reason
        })
      });
      const payload = await response.json() as { ok?: boolean; row?: AdminPointRow; message?: string; error?: string };
      if (!response.ok || !payload.ok || !payload.row) throw new Error(payload.error ?? "Could not update this point record.");
      setRows((current) => current
        .map((row) => row.id === payload.row!.id ? payload.row! : row)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)));
      closeEditor();
      setMessage(payload.message ?? "Point record updated.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this point record.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function removePoint(row: AdminPointRow) {
    setRemovingId(row.id);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/points", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id })
      });
      const payload = await response.json() as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not remove this point record.");
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      if (editing?.id === row.id) setEditing(null);
      setConfirmingId(null);
      setMessage(payload.message ?? "Point record removed. It can be restored from the audit log.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this point record.");
    } finally {
      setRemovingId(null);
    }
  }

  const editInvalid = !editing || !editing.studentId || !editing.activityType ||
    !Number.isInteger(Number(editing.points)) || Number(editing.points) < 1 || Number(editing.points) > 500 ||
    !Number.isInteger(Number(editing.minutes)) || Number(editing.minutes) < 0 || Number(editing.minutes) > 240 ||
    (editing.activityType === "id_specimens" && editing.quantity !== "" && (!Number.isInteger(Number(editing.quantity)) || Number(editing.quantity) < 0 || Number(editing.quantity) > 300)) ||
    (editing.activityType === "custom_activity" && !editing.customLabel.trim()) ||
    !editing.submittedAt || !editing.reason.trim();

  return (
    <div className="min-w-0 space-y-4">
      <section className="min-w-0 rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-5" aria-labelledby="add-points-heading">
        <div>
          <h2 id="add-points-heading" className="text-xl font-semibold text-white">Add points manually</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">Admin adjustments are approved immediately, recorded with your reason, and reversible from the audit log.</p>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void addPoints(); }} aria-busy={saving || undefined}>
        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_130px_130px_minmax(180px,1fr)]">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Student
            <select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white">
              {sortedStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Points
            <input required type="number" min={1} max={500} step={1} value={points} onChange={(event) => setPoints(Number(event.target.value))} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Minutes
            <input required type="number" min={0} max={240} step={1} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Activity label
            <input required maxLength={100} value={label} onChange={(event) => setLabel(event.target.value)} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
          </label>
        </div>
        <label className="mt-3 grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
          Reason for this adjustment
          <textarea required rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for the audit log" className="w-full min-w-0 resize-y rounded-md border border-court-line bg-court-elevated p-3 text-white" />
        </label>
        <button type="submit" disabled={saving || !studentId || !label.trim() || !reason.trim() || !Number.isInteger(points) || points < 1 || points > 500 || !Number.isInteger(minutes) || minutes < 0 || minutes > 240} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <PlusCircle className="h-4 w-4" aria-hidden="true" />}
          {saving ? "Adding points…" : "Add approved points"}
        </button>
        </form>
      </section>

      <section className="min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm">
        <div className="space-y-4 border-b border-court-line p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="point-records-heading" tabIndex={-1} className="text-xl font-semibold text-white focus:outline-none">All point records</h2>
              <p className="mt-1 text-sm text-zinc-500">Edit or remove any incorrect record. Both actions are reversible from the audit log.</p>
            </div>
            <button type="button" onClick={() => void loadRows()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-md border border-court-line px-3 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">
              <RotateCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
            <label className="relative min-w-0">
              <span className="sr-only">Search point records</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or activity" className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated pl-9 pr-3 text-white" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label="Filter point status" className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white">
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {editing ? (
          <form id="admin-point-editor" onSubmit={(event) => { event.preventDefault(); void saveEdit(); }} className="scroll-mt-24 min-w-0 border-b border-court-line bg-court-elevated/50 p-4 sm:p-5" aria-labelledby="point-editor-heading" aria-busy={savingEdit || undefined}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 ref={editorHeadingRef} id="point-editor-heading" tabIndex={-1} className="font-semibold text-white focus:outline-none">Edit point log #{editing.id}</h3>
                <p className="mt-1 text-sm leading-5 text-zinc-500">Saving creates a complete before-and-after audit record. The edit can be undone later.</p>
              </div>
              <button type="button" onClick={closeEditor} disabled={savingEdit} aria-label="Close point editor" className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-court-panel hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 sm:col-span-2">
                Student
                <select value={editing.studentId} onChange={(event) => setEditing({ ...editing, studentId: event.target.value })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white">
                  {!sortedStudents.some((student) => student.id === editing.studentId) ? (
                    <option value={editing.studentId}>
                      {rows.find((row) => row.id === editing.id)?.studentName ?? "Archived person"} (archived)
                    </option>
                  ) : null}
                  {sortedStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 sm:col-span-2">
                Activity type
                <select value={editing.activityType} onChange={(event) => setEditing({ ...editing, activityType: event.target.value as ActivityType })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white">
                  {activityOptions.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                </select>
              </label>
              {editing.activityType === "custom_activity" ? (
                <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 sm:col-span-2 xl:col-span-4">
                  Custom activity label
                  <input maxLength={100} value={editing.customLabel} onChange={(event) => setEditing({ ...editing, customLabel: event.target.value })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white" />
                </label>
              ) : null}
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
                Points
                <input type="number" min={1} max={500} step={1} value={editing.points} onChange={(event) => setEditing({ ...editing, points: event.target.value })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
                Minutes
                <input type="number" min={0} max={240} step={1} value={editing.minutes} onChange={(event) => setEditing({ ...editing, minutes: event.target.value })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white" />
              </label>
              {editing.activityType === "id_specimens" ? (
                <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
                  Quantity
                  <input type="number" min={0} max={300} step={1} value={editing.quantity} onChange={(event) => setEditing({ ...editing, quantity: event.target.value })} placeholder="Optional" className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white" />
                </label>
              ) : null}
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
                Approval status
                <select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as PointLogStatus })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white">
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 sm:col-span-2">
                Submitted date and time
                <input type="datetime-local" step={1} value={editing.submittedAt} onChange={(event) => setEditing({ ...editing, submittedAt: event.target.value })} className="w-full min-w-0 rounded-md border border-court-line bg-court-panel px-3 text-white" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 sm:col-span-2">
                Log notes
                <textarea rows={2} maxLength={2000} value={editing.notes} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} placeholder="Optional notes stored on the point record" className="w-full min-w-0 resize-y rounded-md border border-court-line bg-court-panel p-3 text-white" />
              </label>
              <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 sm:col-span-2 xl:col-span-4">
                Reason for editing
                <textarea rows={2} maxLength={500} required value={editing.reason} onChange={(event) => setEditing({ ...editing, reason: event.target.value })} placeholder="Required for the audit log; this does not replace the log notes" className="w-full min-w-0 resize-y rounded-md border border-court-line bg-court-panel p-3 text-white" />
              </label>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEditor} disabled={savingEdit} className="inline-flex items-center justify-center rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 hover:text-white">Cancel</button>
              <button type="submit" disabled={savingEdit || editInvalid} className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-panel disabled:text-zinc-500">
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                {savingEdit ? "Saving edit…" : "Save audited edit"}
              </button>
            </div>
          </form>
        ) : null}

        {message ? <div className="border-b border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300" role="status">{message}</div> : null}
        {error ? <div className="border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</div> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-zinc-500" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading point records…</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">No point records match these filters.</div>
        ) : (
          <>
            <div className="divide-y divide-court-line md:hidden">
              {visibleRows.map((row) => (
                <article key={row.id} className={`min-w-0 p-4 ${editing?.id === row.id ? "bg-court-elevated/60" : ""}`}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">{row.studentName}</h3>
                      <p className="mt-1 break-words text-sm text-zinc-600">{row.activity}</p>
                    </div>
                    <div className="shrink-0 text-right"><div className="font-semibold tabular-nums text-white">{formatNumber(row.points)} pts</div><StatusBadge status={row.status} /></div>
                  </div>
                  <div className="mt-3 break-words text-xs leading-5 text-zinc-500">{formatDate(row.submittedAt)} · {row.minutes} min{row.quantity !== null ? ` · ${row.quantity} items` : ""}{row.notes ? ` · ${row.notes}` : ""}</div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button type="button" data-point-edit-id={row.id} onClick={() => beginEdit(row)} className="inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-600 hover:bg-court-elevated hover:text-white"><Pencil className="h-4 w-4" /> Edit</button>
                    {confirmingId === row.id ? <><button type="button" onClick={() => setConfirmingId(null)} className="rounded-md px-3 text-sm text-zinc-600">Cancel</button><button type="button" onClick={() => void removePoint(row)} disabled={removingId === row.id} className="rounded-md bg-red-300/10 px-3 text-sm font-semibold text-red-300">{removingId === row.id ? "Removing…" : "Confirm remove"}</button></> : <button type="button" onClick={() => { setConfirmingId(row.id); setEditing(null); }} className="inline-flex items-center gap-2 rounded-md px-3 text-sm font-medium text-red-300 hover:bg-red-300/10"><Trash2 className="h-4 w-4" /> Remove</button>}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 md:block" role="region" aria-labelledby="point-records-heading" tabIndex={0}>
              <table className="w-full min-w-[940px] border-collapse text-left text-sm">
                <caption className="sr-only">Point records matching the current search and status filter</caption>
                <thead className="bg-court-elevated text-xs text-zinc-500"><tr><th scope="col" className="px-4 py-3">Student</th><th scope="col" className="px-4 py-3">Activity</th><th scope="col" className="px-4 py-3">Submitted</th><th scope="col" className="px-4 py-3 text-right">Points</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3">Notes</th><th scope="col" className="px-4 py-3 text-right">Actions</th></tr></thead>
                <tbody>{visibleRows.map((row) => <tr key={row.id} className={`border-t border-court-line ${editing?.id === row.id ? "bg-court-elevated/60" : ""}`}><th scope="row" className="px-4 py-3 text-left font-medium text-white">{row.studentName}</th><td className="px-4 py-3 text-zinc-600"><div>{row.activity}</div><div className="mt-1 text-xs text-zinc-500">{row.minutes} min{row.quantity !== null ? ` · ${row.quantity} items` : ""}</div></td><td className="px-4 py-3 text-zinc-500">{formatDate(row.submittedAt)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-white">{formatNumber(row.points)}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="max-w-64 px-4 py-3 text-zinc-500">{row.notes ?? "—"}</td><td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1"><button type="button" data-point-edit-id={row.id} onClick={() => beginEdit(row)} className="inline-flex items-center gap-2 rounded-md px-3 text-xs font-medium text-zinc-600 hover:bg-court-elevated hover:text-white"><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</button>{confirmingId === row.id ? <><button type="button" onClick={() => setConfirmingId(null)} className="rounded-md px-3 text-xs text-zinc-600">Cancel</button><button type="button" onClick={() => void removePoint(row)} disabled={removingId === row.id} className="rounded-md bg-red-300/10 px-3 text-xs font-semibold text-red-300">{removingId === row.id ? "Removing…" : "Confirm"}</button></> : <button type="button" onClick={() => { setConfirmingId(row.id); setEditing(null); }} className="inline-flex items-center gap-2 rounded-md px-3 text-xs font-medium text-red-300 hover:bg-red-300/10"><Trash2 className="h-4 w-4" aria-hidden="true" /> Remove</button>}</span></td></tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
