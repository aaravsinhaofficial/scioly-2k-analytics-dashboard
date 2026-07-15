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
      <div className="grid min-h-48 place-items-center rounded-md border border-dashed border-court-line bg-court-panel p-6 text-center" role="status">
        <div>
          <p className="font-medium text-white">No progress history yet</p>
          <p className="mt-1 text-sm text-zinc-500">Weekly points, placement, and medal snapshots will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <figure className="rounded-md border border-court-line bg-court-panel p-3 shadow-sm">
      <figcaption className="sr-only">Progress over time. The chart compares historical combined points, average placement, and medals for each weekly snapshot. A data table follows.</figcaption>
      <div className="h-72" aria-hidden="true">
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
            stroke="rgb(var(--color-chart-secondary))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            yAxisId="count"
            type="stepAfter"
            dataKey="medals"
            name="Medals"
            stroke="rgb(var(--color-warning))"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Player progress snapshot data</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Historical combined points</th>
            <th scope="col">Average placement</th>
            <th scope="col">Medals</th>
          </tr>
        </thead>
        <tbody>
          {data.map((entry, index) => (
            <tr key={`${entry.date}-${index}`}>
              <th scope="row">{entry.date}</th>
              <td>{entry.points}</td>
              <td>{entry.avgPlacement}</td>
              <td>{entry.medals}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
