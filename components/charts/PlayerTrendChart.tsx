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
    potential: snapshot.potentialRating ?? snapshot.ovrValue,
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
    <div className="h-72 rounded-md border border-court-line bg-court-panel p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 8, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#a1a1aa" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="points" stroke="#06B6D4" tick={{ fontSize: 12 }} width={42} />
          <YAxis yAxisId="rating" orientation="right" domain={[60, 99]} stroke="#ffffff" tick={{ fontSize: 12 }} width={34} />
          <YAxis yAxisId="count" hide domain={[0, "dataMax + 3"]} />
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
            yAxisId="rating"
            type="monotone"
            dataKey="ovr"
            name="OVR"
            stroke="#ffffff"
            strokeWidth={3}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="rating"
            type="monotone"
            dataKey="potential"
            name="Potential"
            stroke="#EC4899"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="avgPlacement"
            name="Avg Placement"
            stroke="#A855F7"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="count"
            type="stepAfter"
            dataKey="medals"
            name="Medals"
            stroke="#FBBF24"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
