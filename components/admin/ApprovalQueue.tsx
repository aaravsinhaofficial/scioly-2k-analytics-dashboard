"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { activityLabels } from "@/lib/activity";
import type { GrindPointLog, PlayerDetail } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

type ApprovalQueueItem = GrindPointLog & {
  student: PlayerDetail;
};

interface ApprovalQueueProps {
  queue: ApprovalQueueItem[];
}

export function ApprovalQueue({ queue }: ApprovalQueueProps) {
  const [items, setItems] = useState(queue);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function decide(id: number, decision: "approved" | "rejected") {
    const notes = decision === "rejected" ? window.prompt("Reason for rejection?") ?? "" : undefined;
    setBusyId(id);
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/points", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, decision, notes })
        });

        if (!response.ok) {
          throw new Error("Approval API unavailable");
        }

        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
        if (payload.ok) {
          setItems((current) => current.filter((item) => item.id !== id));
        }
        setMessage(payload.message ?? payload.error ?? null);
      } catch {
        setItems((current) => current.filter((item) => item.id !== id));
        setMessage(
          `Static demo: log ${decision}${notes ? ` (${notes})` : ""}. Connect Supabase to persist approval history.`
        );
      }
      setBusyId(null);
    });
  }

  return (
    <div className="rounded-md border border-court-line bg-court-panel">
      <div className="border-b border-court-line p-5">
        <h2 className="text-2xl font-black italic uppercase text-white">Approval Queue</h2>
        <p className="mt-1 text-sm text-zinc-400">Pending point logs across the roster.</p>
      </div>

      {message ? <div className="m-4 rounded-md border border-court-line bg-court-elevated p-3 text-sm text-zinc-300">{message}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Minutes</th>
              <th className="px-4 py-3 text-right">Points</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id} className="border-t border-court-line">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={item.student.name} size="sm" />
                      <div>
                        <div className="font-black text-white">{item.student.name}</div>
                        <div className="text-xs font-bold uppercase text-zinc-500">
                          {item.student.teamDesignation} Team
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-zinc-200">{activityLabels[item.activityType]}</td>
                  <td className="px-4 py-4 text-zinc-400">{formatDate(item.submittedAt)}</td>
                  <td className="px-4 py-4 text-right font-black text-white">{item.minutes}</td>
                  <td className="px-4 py-4 text-right font-black text-cyan-300">{formatNumber(item.points)}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => decide(item.id, "approved")}
                        disabled={isPending && busyId === item.id}
                        className="grid h-9 w-9 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400 hover:text-black"
                        aria-label={`Approve ${item.student.name}'s log`}
                      >
                        {isPending && busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(item.id, "rejected")}
                        disabled={isPending && busyId === item.id}
                        className="grid h-9 w-9 place-items-center rounded-md border border-red-400/40 bg-red-400/10 text-red-200 transition hover:bg-red-400 hover:text-black"
                        aria-label={`Reject ${item.student.name}'s log`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  Approval queue clear.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
