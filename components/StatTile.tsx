import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div className="rounded-md border border-court-line bg-court-elevated p-4">
      <div className="text-[11px] font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-2 min-h-10 text-3xl font-black italic text-white">{value}</div>
      {detail ? <div className="mt-2 text-xs text-zinc-400">{detail}</div> : null}
    </div>
  );
}
