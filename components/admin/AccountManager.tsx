"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import type { PlayerDetail, UserRole } from "@/lib/types";

interface AccountManagerProps {
  students: PlayerDetail[];
}

interface EditableStudent {
  id: string;
  name: string;
  email: string;
  grade: number;
  role: UserRole;
  profileEvents: string;
}

const roles: UserRole[] = ["viewer", "officer", "admin"];

function toEditable(student: PlayerDetail): EditableStudent {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    grade: student.grade,
    role: student.role,
    profileEvents: student.profileEvents?.join(", ") ?? ""
  };
}

export function AccountManager({ students }: AccountManagerProps) {
  const [rows, setRows] = useState(() => students.map(toEditable));
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateRow(id: string, patch: Partial<EditableStudent>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function save(row: EditableStudent) {
    setMessage(null);
    setSavingId(row.id);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/students", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            name: row.name,
            grade: row.grade,
            role: row.role,
            profileEvents: row.profileEvents
              .split(",")
              .map((event) => event.trim())
              .filter(Boolean)
          })
        });

        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error ?? "Could not save student.");
        setMessage(payload?.message ?? `${row.name} updated.`);
      } catch (caught) {
        const fallback = caught instanceof Error ? caught.message : "Static demo: account edit staged locally.";
        setMessage(fallback.includes("fetch") ? "Static demo: account edit staged locally." : fallback);
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-md border border-court-line bg-court-panel">
      <div className="flex flex-col gap-3 border-b border-court-line p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase text-pink-300">
            <Shield className="h-4 w-4" aria-hidden="true" />
            Admin Only
          </div>
          <h2 className="mt-1 text-2xl font-black italic uppercase text-white">Account & Profile Manager</h2>
          <p className="mt-1 text-sm text-zinc-400">Edit role, grade, and listed events for any student account.</p>
        </div>
        {message ? <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Events</th>
              <th className="px-4 py-3">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-court-line">
                <td className="px-4 py-3">
                  <input
                    value={row.name}
                    onChange={(event) => updateRow(row.id, { name: event.target.value })}
                    className="h-10 w-full rounded-md border border-court-line bg-court-elevated px-3 font-bold text-white outline-none focus:border-cyan-400"
                  />
                </td>
                <td className="px-4 py-3 text-zinc-400">{row.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={row.grade}
                    onChange={(event) => updateRow(row.id, { grade: Number(event.target.value) })}
                    className="h-10 rounded-md border border-court-line bg-court-elevated px-3 font-bold text-white outline-none focus:border-cyan-400"
                  >
                    {[9, 10, 11, 12].map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={row.role}
                    onChange={(event) => updateRow(row.id, { role: event.target.value as UserRole })}
                    className="h-10 rounded-md border border-court-line bg-court-elevated px-3 font-bold capitalize text-white outline-none focus:border-cyan-400"
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    value={row.profileEvents}
                    onChange={(event) => updateRow(row.id, { profileEvents: event.target.value })}
                    className="h-10 w-full rounded-md border border-court-line bg-court-elevated px-3 text-white outline-none focus:border-cyan-400"
                    placeholder="Water Quality, Tower"
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => save(row)}
                    disabled={isPending && savingId === row.id}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-xs font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending && savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
