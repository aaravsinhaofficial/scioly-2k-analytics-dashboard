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
    ovr: snapshot.ovrValue,
    points: snapshot.totalPoints
  }));

  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-md border border-court-line bg-court-panel text-sm text-zinc-500">
        No weekly snapshots yet
      </div>
    );
  }

  return (
    <div className="h-72 rounded-md border border-court-line bg-court-panel p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="points" stroke="#06B6D4" tick={{ fontSize: 12 }} width={42} />
          <YAxis yAxisId="ovr" orientation="right" domain={[60, 99]} stroke="#ffffff" tick={{ fontSize: 12 }} width={34} />
          <Tooltip
            contentStyle={{
              background: "#111111",
              border: "1px solid #2b2b2b",
              borderRadius: 6,
              color: "#ffffff"
            }}
            labelStyle={{ color: "#ffffff", fontWeight: 800 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }} />
          <Line
            yAxisId="points"
            type="monotone"
            dataKey="points"
            name="Cumulative Points"
            stroke="#06B6D4"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="ovr"
            type="monotone"
            dataKey="ovr"
            name="OVR"
            stroke="#ffffff"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
