"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import type { PointHistoryRow } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/utils";

interface PointHistoryTableProps {
  rows: PointHistoryRow[];
  canWithdrawPending?: boolean;
  canRemoveAny?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function PointHistoryTable({
  rows: initialRows,
  canWithdrawPending = false,
  canRemoveAny = false,
  emptyTitle = "No practice submitted yet",
  emptyDescription = "Your first submission will appear here."
}: PointHistoryTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setRows(initialRows), [initialRows]);

  const showActions = useMemo(
    () => canRemoveAny || (canWithdrawPending && rows.some((row) => row.status === "pending")),
    [canRemoveAny, canWithdrawPending, rows]
  );

  function canRemove(row: PointHistoryRow) {
    return canRemoveAny || (canWithdrawPending && row.status === "pending");
  }

  async function remove(row: PointHistoryRow) {
    setRemovingId(row.id);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/points", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: row.id })
      });
      const result = await response.json() as { ok?: boolean; error?: string; message?: string; persisted?: boolean };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not remove this point entry.");

      setRows((current) => current.filter((item) => item.id !== row.id));
      setConfirmingId(null);
      setMessage(result.message ?? "Point entry removed.");
      if (result.persisted !== false) router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove this point entry.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      {message ? <div className="border-b border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300" role="status">{message}</div> : null}
      {error ? <div className="border-b border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</div> : null}
      {rows.length > 0 ? (
        <div role="region" tabIndex={0} aria-label="Practice point submission history table" className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400" aria-busy={removingId !== null}>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <caption className="sr-only">Practice point submissions, review status, and available actions</caption>
            <thead className="bg-court-elevated text-xs font-medium text-zinc-500">
              <tr>
                <th scope="col" className="px-4 py-3">Submitted</th>
                <th scope="col" className="px-4 py-3">Activity</th>
                <th scope="col" className="px-4 py-3 text-right">Points</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Review</th>
                {showActions ? <th scope="col" className="px-4 py-3 text-right">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const removable = canRemove(row);
                const isConfirming = confirmingId === row.id;
                const isRemoving = removingId === row.id;
                const actionLabel = canRemoveAny ? "Remove" : "Withdraw";

                return (
                  <tr key={row.id} className="border-t border-court-line align-middle">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(row.date)}</td>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-white">{row.activity}</th>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-white">{formatNumber(row.points)}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="max-w-64 px-4 py-3 text-zinc-500">
                      {row.notes ?? (row.approvedBy ? `Reviewed by ${row.approvedBy}` : "Not reviewed yet")}
                    </td>
                    {showActions ? (
                      <td className="px-4 py-2 text-right">
                        {removable ? (
                          isConfirming ? (
                            <span className="inline-flex items-center justify-end gap-2" role="group" aria-label={`${actionLabel} ${row.activity} submission`}>
                              <button
                                type="button"
                                onClick={() => setConfirmingId(null)}
                                disabled={isRemoving}
                                autoFocus
                                className="min-h-10 rounded-md px-3 text-xs font-medium text-zinc-600 hover:bg-court-elevated hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(row)}
                                disabled={isRemoving}
                                aria-label={`Confirm ${actionLabel.toLowerCase()} for ${row.activity}`}
                                className="min-h-10 rounded-md bg-red-300/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-300/20 disabled:text-zinc-500"
                              >
                                {isRemoving ? "Removing…" : `Confirm ${actionLabel.toLowerCase()}`}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingId(row.id);
                                setError(null);
                                setMessage(null);
                              }}
                              aria-label={`${actionLabel} ${row.activity} submission from ${formatDate(row.date)}`}
                              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-medium text-red-300 hover:bg-red-300/10"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              {actionLabel}
                            </button>
                          )
                        ) : <span className="text-xs text-zinc-500">Reviewed</span>}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-10 text-center">
          <p className="font-medium text-white">{emptyTitle}</p>
          <p className="mt-1 text-sm text-zinc-500">{emptyDescription}</p>
        </div>
      )}
    </>
  );
}
