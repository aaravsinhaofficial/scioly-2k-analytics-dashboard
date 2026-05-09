"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function undo(log: AuditLogEntry) {
    setMessage(null);
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
        const fallback = caught instanceof Error ? caught.message : "Static demo: reversal staged locally.";
        const now = new Date().toISOString();
        setRows((current) => [
          {
            id: Math.max(...current.map((entry) => entry.id)) + 1,
            actorId: currentUser.id,
            actorName: currentUser.name,
            action: "audit.undo",
            target: log.target,
            reason: fallback.includes("fetch") ? "Static demo reversal" : fallback,
            ipAddress: "local",
            reversalOf: log.id,
            isReversible: false,
            createdAt: now
          },
          ...current.map((entry) =>
            entry.id === log.id ? { ...entry, isReversed: true, reversedAt: now, reversedBy: currentUser.id } : entry
          )
        ]);
        setMessage(fallback.includes("fetch") ? "Static demo: reversal staged locally." : fallback);
      } finally {
        setUndoingId(null);
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-court-line bg-court-panel">
      <div className="flex flex-col gap-3 border-b border-court-line p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black italic uppercase text-white">System Audit Log</h2>
          <p className="mt-1 text-sm text-zinc-400">Admin undo creates a new reversal entry and marks the original as reversed.</p>
        </div>
        {message ? <div className="rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Undo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log) => {
              const canUndo = currentUser.role === "admin" && log.isReversible && !log.isReversed && log.action !== "audit.undo";
              return (
                <tr key={log.id} className="border-t border-court-line">
                  <td className="px-4 py-4 text-zinc-400">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-4 font-black text-white">{log.actorName}</td>
                  <td className="px-4 py-4 font-mono text-xs text-cyan-300">{log.action}</td>
                  <td className="px-4 py-4 text-zinc-200">{log.target}</td>
                  <td className="px-4 py-4 text-zinc-400">{log.reason ?? "-"}</td>
                  <td className="px-4 py-4 text-zinc-400">
                    {log.reversalOf ? `Reversal of #${log.reversalOf}` : log.isReversed ? "Reversed" : "Active"}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => undo(log)}
                      disabled={!canUndo || (isPending && undoingId === log.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-court-line px-3 text-xs font-black uppercase text-zinc-300 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isPending && undoingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Undo
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
