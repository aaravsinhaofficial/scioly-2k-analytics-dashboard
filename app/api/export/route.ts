import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getAnalyticsForRequest } from "@/lib/data";
import { hasSupabaseConfig } from "@/lib/supabase";
import { csvEscape } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  if (hasSupabaseConfig() && !(await getAuthenticatedStudent())) {
    return NextResponse.json({ ok: false, error: "Sign in before exporting team data." }, { status: 401 });
  }

  const analytics = await getAnalyticsForRequest();
  const rows = analytics.getLeaderboardPlayers().map((player) => [
    player.rank,
    player.name,
    player.teamDesignation,
    player.grade,
    player.readinessScore,
    player.readinessIsProvisional ? "Provisional" : "Complete",
    player.competitionScore,
    player.testoffScore,
    player.preparationScore,
    player.studyRating ?? "N/A",
    player.buildRating ?? "N/A",
    player.approvedPracticePoints,
    player.pendingPracticePoints,
    player.competitionPoints,
    player.thirtyDayPoints,
    player.avgPlacement ?? "N/A",
    player.tournamentsAttended,
    player.medalCount,
    player.profileEvents?.join("; ") ?? ""
  ]);

  const csv = [
    [
      "Rank",
      "Name",
      "Team",
      "Grade",
      "Readiness",
      "Readiness Evidence",
      "Competition Component",
      "Testoff Component",
      "Preparation Component",
      "Study",
      "Build",
      "Approved Practice Points",
      "Pending Practice Points",
      "Competition Points",
      "30D Points",
      "Avg Placement",
      "Tournaments",
      "Medals",
      "Events"
    ],
    ...rows
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="sciolytracker-export.csv"',
      "cache-control": "private, no-store"
    }
  });
}
