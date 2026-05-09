import { NextResponse } from "next/server";
import { getLeaderboardPlayers } from "@/lib/analytics";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getLeaderboardPlayers().map((player) => [
    player.rank,
    player.name,
    player.teamDesignation,
    player.grade,
    player.ovrRating,
    player.studyRating ?? "N/A",
    player.buildRating ?? "N/A",
    player.totalPoints,
    player.thirtyDayPoints,
    player.avgPlacement ?? "N/A",
    player.tournamentsAttended
  ]);

  const csv = [
    [
      "Rank",
      "Name",
      "Team",
      "Grade",
      "OVR",
      "Study",
      "Build",
      "Total Points",
      "30D Points",
      "Avg Placement",
      "Tournaments"
    ],
    ...rows
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="scioly-2k-export.csv"'
    }
  });
}
