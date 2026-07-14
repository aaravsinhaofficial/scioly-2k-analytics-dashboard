"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Pencil, Plus, RotateCcw, Save, Search, Shield, UserPlus, X } from "lucide-react";
import type { PlayerDetail, UserRole } from "@/lib/types";

interface AccountManagerProps {
  students: PlayerDetail[];
  teams?: Array<{ id: string; label: string }>;
}

type StudentWithArchiveState = Pick<PlayerDetail, "id" | "name" | "email" | "grade" | "role" | "profileEvents"> & {
  isArchived?: boolean;
  accountDeleted?: boolean;
  archivedAt?: string | null;
  hasLogin?: boolean;
};

interface EditableStudent {
  id: string;
  name: string;
  email: string;
  grade: number;
  role: UserRole;
  profileEvents: string;
  isArchived: boolean;
  accountDeleted: boolean;
  hasLogin: boolean;
}

interface NewStudent {
  name: string;
  email: string;
  grade: number;
  profileEvents: string;
  teamId: string;
}

type StatusFilter = "active" | "archived" | "all";

const roles: UserRole[] = ["viewer", "officer", "admin"];
const grades = [9, 10, 11, 12];
const emptyStudent: NewStudent = {
  name: "",
  email: "",
  grade: 9,
  profileEvents: "",
  teamId: ""
};

function toEditable(student: StudentWithArchiveState): EditableStudent {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    grade: student.grade,
    role: student.role,
    profileEvents: student.profileEvents?.join(", ") ?? "",
    isArchived: Boolean(student.isArchived || student.archivedAt),
    accountDeleted: Boolean(student.accountDeleted),
    hasLogin: Boolean(student.hasLogin)
  };
}

function splitEvents(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((event) => event.trim())
        .filter(Boolean)
    )
  );
}

function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`min-w-0 space-y-1.5 text-xs font-bold text-zinc-500 ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-11 w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60";

export function AccountManager({ students, teams = [] }: AccountManagerProps) {
  const router = useRouter();
  const [rows, setRows] = useState(() => (students as StudentWithArchiveState[]).map(toEditable));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState<NewStudent>(emptyStudent);
  const [studentToArchive, setStudentToArchive] = useState<EditableStudent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(true);

  async function loadAllPeople(signal?: AbortSignal) {
    try {
      const response = await fetch("/api/admin/students", {
        method: "GET",
        cache: "no-store",
        signal
      });
      const payload = (await response.json().catch(() => null)) as {
        students?: StudentWithArchiveState[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Could not load all people.");
      if (Array.isArray(payload?.students)) setRows(payload.students.map(toEditable));
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Could not load all people.");
    } finally {
      if (!signal?.aborted) setLoadingPeople(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadAllPeople(controller.signal);
    return () => controller.abort();
    // Loading once on mount avoids replacing the active + archived response with active-only server props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const refreshPeople = () => void loadAllPeople();
    window.addEventListener("scioly:data-updated", refreshPeople);
    return () => window.removeEventListener("scioly:data-updated", refreshPeople);
    // The global live-refresh signal keeps this client-owned active/archived list current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(
    () => ({
      active: rows.filter((row) => !row.isArchived).length,
      archived: rows.filter((row) => row.isArchived).length,
      all: rows.length
    }),
    [rows]
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "active" && row.isArchived) return false;
      if (statusFilter === "archived" && !row.isArchived) return false;
      if (!normalizedQuery) return true;
      return [row.name, row.email, row.role, String(row.grade), row.profileEvents]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }, [query, rows, statusFilter]);

  function clearFeedback() {
    setMessage(null);
    setError(null);
  }

  function updateRow(id: string, patch: Partial<EditableStudent>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function parseResponse(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    if (!response.ok) throw new Error(payload?.error ?? fallback);
    return payload;
  }

  async function addStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    if (!newStudent.name.trim() || !newStudent.email.trim()) {
      setError("Enter the person's name and email address.");
      return;
    }

    setAdding(true);
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStudent.name.trim(),
          email: newStudent.email.trim(),
          grade: newStudent.grade,
          role: "viewer",
          profileEvents: splitEvents(newStudent.profileEvents),
          teamId: newStudent.teamId || undefined
        })
      });
      const payload = await parseResponse(response, "Could not add this person.");
      setMessage(payload?.message ?? `${newStudent.name.trim()} was added.`);
      setNewStudent(emptyStudent);
      setShowAddForm(false);
      setStatusFilter("active");
      await loadAllPeople();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this person.");
    } finally {
      setAdding(false);
    }
  }

  async function save(row: EditableStudent) {
    clearFeedback();
    if (!row.name.trim() || !row.email.trim()) {
      setError("A name and email address are required.");
      return;
    }

    setSavingId(row.id);
    try {
      const response = await fetch("/api/admin/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          name: row.name.trim(),
          email: row.email.trim(),
          grade: row.grade,
          role: row.role,
          profileEvents: splitEvents(row.profileEvents)
        })
      });
      const payload = await parseResponse(response, "Could not save this person.");
      setMessage(payload?.message ?? `${row.name.trim()} was updated.`);
      setEditingId(null);
      await loadAllPeople();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this person.");
    } finally {
      setSavingId(null);
    }
  }

  async function archiveStudent() {
    if (!studentToArchive) return;
    clearFeedback();
    setArchiving(true);
    try {
      const response = await fetch("/api/admin/students", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: studentToArchive.id })
      });
      const payload = await parseResponse(response, "Could not remove this person.");
      updateRow(studentToArchive.id, { isArchived: true });
      setMessage(payload?.message ?? `${studentToArchive.name} was archived.`);
      setStudentToArchive(null);
      await loadAllPeople();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this person.");
    } finally {
      setArchiving(false);
    }
  }

  async function restoreStudent(row: EditableStudent) {
    clearFeedback();
    setRestoringId(row.id);
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", id: row.id })
      });
      const payload = await parseResponse(response, "Could not restore this person.");
      updateRow(row.id, { isArchived: false });
      setMessage(payload?.message ?? `${row.name} was restored.`);
      await loadAllPeople();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not restore this person.");
    } finally {
      setRestoringId(null);
    }
  }

  function renderFields(row: EditableStudent, layout: "row" | "card") {
    const archived = row.isArchived;
    return (
      <>
        <FormField label="Name" className={layout === "row" ? "lg:col-span-2" : "sm:col-span-2"}>
          <input
            value={row.name}
            disabled={archived}
            onChange={(event) => updateRow(row.id, { name: event.target.value })}
            className={inputClassName}
          />
        </FormField>
        <FormField label="Email" className={layout === "row" ? "lg:col-span-2" : "sm:col-span-2"}>
          <input
            type="email"
            inputMode="email"
            value={row.email}
            disabled={archived || row.hasLogin}
            onChange={(event) => updateRow(row.id, { email: event.target.value })}
            className={inputClassName}
          />
          {row.hasLogin ? <span className="block font-normal text-zinc-500">This email is connected to their login and cannot be changed here.</span> : null}
        </FormField>
        <FormField label="Grade">
          <select
            value={row.grade}
            disabled={archived}
            onChange={(event) => updateRow(row.id, { grade: Number(event.target.value) })}
            className={inputClassName}
          >
            {grades.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Role">
          <select
            value={row.role}
            disabled={archived}
            onChange={(event) => updateRow(row.id, { role: event.target.value as UserRole })}
            className={`${inputClassName} capitalize`}
          >
            {roles.map((role) => (
              <option key={role} value={role} disabled={!row.hasLogin && role !== "viewer"}>
                {role}
              </option>
            ))}
          </select>
          {!row.hasLogin ? <span className="block font-normal text-zinc-500">Profile-only records must stay viewers. Connect a login before granting officer or admin access.</span> : null}
        </FormField>
        <FormField label="Event assignments" className={layout === "row" ? "lg:col-span-3" : "sm:col-span-2"}>
          <input
            value={row.profileEvents}
            disabled={archived}
            onChange={(event) => updateRow(row.id, { profileEvents: event.target.value })}
            className={inputClassName}
            placeholder="Water Quality, Tower"
          />
        </FormField>
      </>
    );
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel">
      <div className="flex flex-col gap-4 border-b border-court-line p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-300">
            <Shield className="h-4 w-4" aria-hidden="true" />
            Admin only
          </div>
          <h2 className="mt-1 text-xl font-semibold text-white">People</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Add people, update their profiles, or archive anyone who is no longer on the team. Archived people can be restored unless they deleted their own account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearFeedback();
            setShowAddForm((current) => !current);
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black text-black transition hover:bg-cyan-200 sm:w-auto"
        >
          {showAddForm ? <X className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
          {showAddForm ? "Close" : "Add person"}
        </button>
      </div>

      {showAddForm ? (
        <form onSubmit={addStudent} className="border-b border-court-line bg-court-elevated/40 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-white">Add someone to the tracker</h3>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <FormField label="Full name" className="lg:col-span-2">
              <input
                required
                autoFocus
                value={newStudent.name}
                onChange={(event) => setNewStudent((current) => ({ ...current, name: event.target.value }))}
                className={inputClassName}
                placeholder="Student name"
              />
            </FormField>
            <FormField label="Email" className="lg:col-span-2">
              <input
                required
                type="email"
                inputMode="email"
                autoComplete="email"
                value={newStudent.email}
                onChange={(event) => setNewStudent((current) => ({ ...current, email: event.target.value }))}
                className={inputClassName}
                placeholder="student@example.com"
              />
            </FormField>
            <FormField label="Grade" className="lg:col-span-2">
              <select
                value={newStudent.grade}
                onChange={(event) => setNewStudent((current) => ({ ...current, grade: Number(event.target.value) }))}
                className={inputClassName}
              >
                {grades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </FormField>
            {teams.length ? (
              <FormField label="Starting team (optional)" className="sm:col-span-2 lg:col-span-3">
                <select
                  value={newStudent.teamId}
                  onChange={(event) => setNewStudent((current) => ({ ...current, teamId: event.target.value }))}
                  className={inputClassName}
                >
                  <option value="">Unassigned</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}
            <FormField label="Event assignments (optional)" className={`sm:col-span-2 ${teams.length ? "lg:col-span-3" : "lg:col-span-6"}`}>
              <input
                value={newStudent.profileEvents}
                onChange={(event) => setNewStudent((current) => ({ ...current, profileEvents: event.target.value }))}
                className={inputClassName}
                placeholder="Water Quality, Tower, Codebusters"
              />
              <span className="block font-normal text-zinc-500">Separate multiple events with commas. These can be changed at any time.</span>
            </FormField>
          </div>
          <div className="mt-4 rounded-md border border-court-line bg-court-panel p-3 text-xs leading-5 text-zinc-500">
            This creates their tracker profile, not a password. When you invite them, use this same email so their login connects automatically.
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setNewStudent(emptyStudent);
              }}
              className="h-11 rounded-md border border-court-line px-4 text-sm font-bold text-zinc-300 hover:bg-court-panel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
              Add person
            </button>
          </div>
        </form>
      ) : null}

      <div aria-live="polite" className="px-4 pt-4 sm:px-5">
        {message ? <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</div> : null}
        {error ? <div className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div> : null}
      </div>

      <div className="grid min-w-0 gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative min-w-0">
          <span className="sr-only">Search people</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${inputClassName} pl-10`}
            placeholder="Search by name, email, event, grade, or role"
          />
        </label>
        <div className="grid grid-cols-3 rounded-md border border-court-line bg-court-elevated p-1" aria-label="People status filter">
          {(["active", "archived", "all"] as StatusFilter[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              aria-pressed={statusFilter === status}
              className={`min-w-0 rounded px-3 py-2 text-xs font-bold capitalize transition ${
                statusFilter === status ? "bg-white text-black" : "text-zinc-500 hover:text-white"
              }`}
            >
              <span className="truncate">{status}</span> <span aria-hidden="true">({counts[status]})</span>
            </button>
          ))}
        </div>
      </div>

      {loadingPeople ? (
        <div className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-md border border-court-line p-4 text-sm text-zinc-500 sm:mx-5 sm:mb-5">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading active and archived people…
        </div>
      ) : null}

      {!loadingPeople && visibleRows.length ? (
        <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
          {visibleRows.map((row) => (
            <article key={row.id} className="min-w-0 rounded-md border border-court-line bg-court-elevated/50 p-4">
              <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">{row.name}</h3>
                    {row.accountDeleted ? (
                      <span className="rounded-full border border-red-300/30 bg-red-300/10 px-2 py-0.5 text-[10px] font-black uppercase text-red-200">Account deleted</span>
                    ) : row.isArchived ? (
                      <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black uppercase text-amber-200">Archived</span>
                    ) : null}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${row.hasLogin ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-court-line bg-court-panel text-zinc-500"}`}>
                      {row.hasLogin ? "Login connected" : "Profile only"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{row.email}</p>
                </div>
                {row.isArchived && !row.accountDeleted ? (
                  <button
                    type="button"
                    onClick={() => restoreStudent(row)}
                    disabled={restoringId === row.id}
                    className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-md border border-court-line px-3 text-xs font-black text-zinc-300 transition hover:border-cyan-400 hover:text-white disabled:opacity-60 sm:w-auto"
                  >
                    {restoringId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Restore
                  </button>
                ) : row.accountDeleted ? (
                  <span className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-red-300/20 px-3 text-xs font-semibold text-red-200">
                    Cannot restore
                  </span>
                ) : editingId !== row.id ? (
                  <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                    <button
                      type="button"
                      onClick={() => {
                        clearFeedback();
                        setEditingId(row.id);
                      }}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-court-line px-3 text-xs font-black text-zinc-300 transition hover:border-cyan-400 hover:text-white"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudentToArchive(row)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-black text-red-300 transition hover:bg-red-300/10"
                      aria-label={`Remove ${row.name}`}
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
              {editingId === row.id && !row.isArchived ? (
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-9">{renderFields(row, "row")}</div>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="rounded-full border border-court-line bg-court-panel px-2.5 py-1">Grade {row.grade}</span>
                  <span className="rounded-full border border-court-line bg-court-panel px-2.5 py-1 capitalize">{row.role}</span>
                  <span className="min-w-0 break-words">
                    {row.profileEvents ? row.profileEvents : "No event assignments"}
                  </span>
                </div>
              )}
              {editingId === row.id && !row.isArchived ? (
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setStudentToArchive(row)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-xs font-black text-red-300 transition hover:bg-red-300/10"
                  >
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    Remove person
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      void loadAllPeople();
                    }}
                    className="h-10 rounded-md border border-court-line px-3 text-xs font-black text-zinc-300 transition hover:bg-court-panel hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => save(row)}
                    disabled={savingId === row.id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-4 text-xs font-black uppercase text-black transition hover:bg-cyan-200 disabled:opacity-60"
                  >
                    {savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save changes
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : !loadingPeople ? (
        <div className="mx-4 mb-4 rounded-md border border-dashed border-court-line p-8 text-center sm:mx-5 sm:mb-5">
          <p className="text-sm font-semibold text-white">No people found</p>
          <p className="mt-1 text-xs text-zinc-500">Try a different search or status filter.</p>
        </div>
      ) : null}

      {studentToArchive ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/70 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="archive-person-title" className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-xl border border-court-line bg-court-panel p-5 shadow-2xl sm:max-w-md sm:rounded-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="archive-person-title" className="text-lg font-semibold text-white">Archive {studentToArchive.name}?</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  They will be hidden from active lists and cannot sign in. Their history stays intact, and an admin can restore them later.
                </p>
              </div>
              <button type="button" onClick={() => setStudentToArchive(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-court-elevated hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setStudentToArchive(null)} disabled={archiving} className="h-11 rounded-md border border-court-line px-4 text-sm font-bold text-zinc-300 hover:bg-court-elevated disabled:opacity-60">
                Keep person
              </button>
              <button type="button" onClick={archiveStudent} disabled={archiving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-400 px-4 text-sm font-black text-slate-950 hover:bg-red-300 disabled:opacity-60">
                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Archive person
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
