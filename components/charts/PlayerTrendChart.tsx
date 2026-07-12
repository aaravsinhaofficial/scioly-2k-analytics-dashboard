"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { OvrSnapshot } from "@/lib/types";

interface PlayerTrendChartProps {
  snapshots: OvrSnapshot[];
}

export function PlayerTrendChart({ snapshots }: PlayerTrendChartProps) {
  const data = snapshots.map((snapshot) => ({
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(snapshot.recordedAt)),
    points: snapshot.totalPoints,
    avgPlacement: snapshot.avgPlacement,
    medals: snapshot.medalCount ?? 0
  }));

  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-md border border-court-line bg-court-panel text-sm text-zinc-500">
        No weekly snapshots yet
      </div>
    );
  }

  return (
    <div className="h-72 rounded-md border border-court-line bg-court-panel p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgb(var(--color-line))" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="rgb(var(--color-zinc-500))" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="points" stroke="rgb(var(--color-accent))" tick={{ fontSize: 12 }} width={42} />
          <YAxis yAxisId="count" hide domain={[0, "dataMax + 3"]} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--color-panel))",
              border: "1px solid rgb(var(--color-line))",
              borderRadius: 10,
              color: "rgb(var(--color-ink))",
              boxShadow: "0 8px 24px rgb(var(--color-shadow) / 0.12)"
            }}
            labelStyle={{ color: "rgb(var(--color-ink))", fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 500 }} />
          <Line
            yAxisId="points"
            type="monotone"
            dataKey="points"
            name="Historical combined points"
            stroke="rgb(var(--color-accent))"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="avgPlacement"
            name="Avg Placement"
            stroke="#6f61a8"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="count"
            type="stepAfter"
            dataKey="medals"
            name="Medals"
            stroke="#b27524"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
