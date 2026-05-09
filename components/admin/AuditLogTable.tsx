import type { AuditLogEntry } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface AuditLogTableProps {
  logs: AuditLogEntry[];
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-court-line bg-court-panel">
      <div className="border-b border-court-line p-5">
        <h2 className="text-2xl font-black italic uppercase text-white">System Audit Log</h2>
        <p className="mt-1 text-sm text-zinc-400">Officer and admin actions with timestamp, actor, target, and IP.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-court-elevated text-[11px] font-black uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-court-line">
                <td className="px-4 py-4 text-zinc-400">{formatDate(log.createdAt)}</td>
                <td className="px-4 py-4 font-black text-white">{log.actorName}</td>
                <td className="px-4 py-4 font-mono text-xs text-cyan-300">{log.action}</td>
                <td className="px-4 py-4 text-zinc-200">{log.target}</td>
                <td className="px-4 py-4 text-zinc-400">{log.reason ?? "-"}</td>
                <td className="px-4 py-4 text-zinc-400">{log.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
