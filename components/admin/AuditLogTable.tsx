"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import type { AuditLogEntry, Student } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  currentUser: Student;
}

export function AuditLogTable({ logs, currentUser }: AuditLogTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState(logs);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setRows(logs), [logs]);

  function undo(log: AuditLogEntry) {
    setMessage(null);
    setError(null);
    setUndoingId(log.id);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/audit/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auditId: log.id, reason: `Admin undo by ${currentUser.name}` })
        });
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        if (!response.ok) throw new Error(payload?.error ?? "Undo failed.");
        setMessage(payload?.message ?? "Audit action reversed.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not reverse this audit entry.");
      } finally {
        setUndoingId(null);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-court-line bg-court-panel">
      <div className="flex flex-col gap-3 border-b border-court-line p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="audit-log-heading" className="text-xl font-semibold text-white">System audit log</h2>
          <p className="mt-1 text-sm text-zinc-500">Admin undo creates a new reversal entry and marks the original as reversed.</p>
        </div>
        <div className="space-y-2">
          {message ? <div role="status" className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-300">{message}</div> : null}
          {error ? <div role="alert" className="rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300">{error}</div> : null}
        </div>
      </div>
      <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400" role="region" aria-labelledby="audit-log-heading" tabIndex={0}>
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <caption className="sr-only">Administrative actions, their status, and available reversal actions</caption>
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3">Time</th>
              <th scope="col" className="px-4 py-3">Actor</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Target</th>
              <th scope="col" className="px-4 py-3">Reason</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Undo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => {
              const canUndo = currentUser.role === "admin" && log.isReversible && !log.isReversed && log.action !== "audit.undo";
              const undoLabel = log.undoAction === "points.restore" ? "Restore" : "Undo";
              const undoBusyLabel = undoLabel === "Restore" ? "Restoring…" : "Undoing…";
              return (
                <tr key={log.id} className="border-t border-court-line">
                  <th scope="row" className="px-4 py-4 text-left font-normal text-zinc-500">{formatDate(log.createdAt)}</th>
                  <td className="px-4 py-4 font-black text-white">{log.actorName}</td>
                  <td className="px-4 py-4 font-mono text-xs text-cyan-300">{log.action}</td>
                  <td className="px-4 py-4 text-white">{log.target}</td>
                  <td className="px-4 py-4 text-zinc-500">{log.reason ?? "-"}</td>
                  <td className="px-4 py-4 text-zinc-500">
                    {log.reversalOf ? `Reversal of #${log.reversalOf}` : log.isReversed ? "Reversed" : "Active"}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => undo(log)}
                      disabled={!canUndo || isPending}
                      aria-busy={isPending && undoingId === log.id}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-court-line px-3 text-xs font-black uppercase text-zinc-600 transition hover:border-cyan-400 hover:text-white disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100"
                    >
                      {isPending && undoingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                      {isPending && undoingId === log.id ? undoBusyLabel : undoLabel}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-500">No audit entries found.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
