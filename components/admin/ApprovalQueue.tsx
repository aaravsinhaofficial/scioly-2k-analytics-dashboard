"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { activityLabels } from "@/lib/activity";
import type { GrindPointLog, PlayerDetail } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";
import { AdminDialog } from "@/components/admin/AdminDialog";

type ApprovalQueueItem = GrindPointLog & {
  student: PlayerDetail;
};

interface ApprovalQueueProps {
  queue: ApprovalQueueItem[];
}

export function ApprovalQueue({ queue }: ApprovalQueueProps) {
  const router = useRouter();
  const [items, setItems] = useState(queue);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ApprovalQueueItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const rejectionReasonRef = useRef<HTMLTextAreaElement>(null);
  const [isPending, startTransition] = useTransition();

  function decide(id: number, decision: "approved" | "rejected", notes?: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/points", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, decision, notes })
        });

        const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Could not update this point log.");
        }
        if (payload.ok) {
          setItems((current) => current.filter((item) => item.id !== id));
        }
        setMessage(payload.message ?? "Point log updated.");
        router.refresh();
        setRejecting(null);
        setRejectionReason("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update this point log.");
      }
      setBusyId(null);
    });
  }

  return (
    <div className="rounded-md border border-court-line bg-court-panel">
      <div className="border-b border-court-line p-5">
        <div className="flex items-center gap-3"><h2 id="approval-queue-heading" className="text-xl font-semibold text-white">Approval queue</h2><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300">{items.length} pending</span></div>
        <p className="mt-1 text-sm text-zinc-500">Review submitted preparation. Every decision can be reversed by an admin from the audit log.</p>
      </div>

      {message ? <div className="m-4 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-300" role="status">{message}</div> : null}
      {error ? <div className="m-4 rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300" role="alert">{error}</div> : null}

      <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400" role="region" aria-labelledby="approval-queue-heading" tabIndex={0}>
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <caption className="sr-only">Pending practice logs awaiting an approval or rejection decision</caption>
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th scope="col" className="px-4 py-3">Student</th>
              <th scope="col" className="px-4 py-3">Activity</th>
              <th scope="col" className="px-4 py-3">Submitted</th>
              <th scope="col" className="px-4 py-3 text-right">Details</th>
              <th scope="col" className="px-4 py-3 text-right">Points</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id} className="border-t border-court-line">
                  <th scope="row" className="px-4 py-4 text-left">
                    <Link href={`/profile/${item.student.id}`} className="flex items-center gap-3 rounded hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                      <Avatar name={item.student.name} size="sm" />
                      <div>
                        <div className="font-black text-white">{item.student.name}</div>
                        <div className="text-xs font-bold uppercase text-zinc-500">
                          {item.student.teamDesignation} Team
                        </div>
                      </div>
                    </Link>
                  </th>
                  <td className="px-4 py-4 font-bold text-white">{activityLabels[item.activityType]}</td>
                  <td className="px-4 py-4 text-zinc-500">{formatDate(item.submittedAt)}</td>
                  <td className="px-4 py-4 text-right font-medium text-white">
                    {item.minutes > 0 ? `${item.minutes} min` : item.quantity ? `${item.quantity} items` : "—"}
                  </td>
                  <td className="px-4 py-4 text-right font-black text-cyan-300">{formatNumber(item.points)}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => decide(item.id, "approved")}
                        disabled={isPending}
                        aria-busy={isPending && busyId === item.id}
                        className="grid h-9 w-9 place-items-center rounded-md border border-emerald-400/40 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400 hover:text-black"
                        aria-label={`Approve ${item.student.name}'s log`}
                      >
                        {isPending && busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejecting(item); setRejectionReason(""); setError(null); setMessage(null); }}
                        disabled={isPending}
                        className="grid h-9 w-9 place-items-center rounded-md border border-red-400/40 bg-red-400/10 text-red-200 transition hover:bg-red-400 hover:text-black"
                        aria-label={`Reject ${item.student.name}'s log`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
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

      {rejecting ? (
        <AdminDialog
          labelledBy="reject-heading"
          describedBy="reject-description"
          initialFocusRef={rejectionReasonRef}
          closeDisabled={isPending}
          busy={isPending}
          onClose={() => { setRejecting(null); setRejectionReason(""); }}
          panelClassName="max-w-md p-5"
        >
          <form onSubmit={(event) => { event.preventDefault(); decide(rejecting.id, "rejected", rejectionReason.trim()); }}>
            <h2 id="reject-heading" className="text-xl font-semibold text-white">Reject {rejecting.student.name}&apos;s entry?</h2>
            <p id="reject-description" className="mt-2 text-sm leading-6 text-zinc-500">Give a useful reason so the student knows what to correct. An admin can undo this decision later.</p>
            <label className="mt-4 grid gap-2 text-sm font-medium text-zinc-600">
              Reason
              <textarea ref={rejectionReasonRef} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} required disabled={isPending} className="rounded-md border border-court-control bg-court-panel p-3 text-white outline-none focus:border-cyan-400" />
            </label>
            {error ? <div className="mt-4 rounded-md border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-300" role="alert">{error}</div> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setRejecting(null); setRejectionReason(""); }} disabled={isPending} className="rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600">Cancel</button>
              <button type="submit" disabled={!rejectionReason.trim() || isPending} className="inline-flex items-center gap-2 rounded-md bg-red-400 px-4 text-sm font-semibold text-black disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100">{isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{isPending ? "Rejecting…" : "Reject entry"}</button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </div>
  );
}
