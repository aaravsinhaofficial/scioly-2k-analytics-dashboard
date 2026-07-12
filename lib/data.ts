import "server-only";

import { notFound, redirect } from "next/navigation";
import { getAuthenticatedStudent } from "@/lib/auth";
import {
  createAnalytics,
  demoAnalyticsDataset,
  getCurrentDemoUser,
} from "@/lib/analytics";
import { schoolName } from "@/lib/seed";
import { hasSupabaseConfig, isDemoMode } from "@/lib/supabase";
import { loadSupabaseAnalyticsDataset } from "@/lib/supabase-data";
import { roleMeets } from "@/lib/utils";
import type { PlayerDetail, Student, TeamComparison, UserRole } from "@/lib/types";

export async function getAnalyticsForRequest() {
  if (!hasSupabaseConfig()) {
    if (!isDemoMode()) {
      throw new Error("SciOly Tracker is missing its Supabase environment variables.");
    }
    return createAnalytics(demoAnalyticsDataset);
  }

  return createAnalytics(await loadSupabaseAnalyticsDataset());
}

export async function getCurrentUser() {
  const authenticatedStudent = await getAuthenticatedStudent();
  if (authenticatedStudent) {
    return authenticatedStudent;
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login");
  }

  if (!isDemoMode()) {
    throw new Error("SciOly Tracker is missing its Supabase environment variables.");
  }

  return getCurrentDemoUser();
}

export async function requireRole(minimumRole: UserRole) {
  const user = await getCurrentUser();
  if (!roleMeets(user.role, minimumRole)) {
    redirect("/dashboard");
  }
  return user;
}

function includeCurrentUser(
  players: PlayerDetail[],
  currentUser: Student,
  detailForStudent: (student: Student, rank?: number) => PlayerDetail
) {
  if (players.some((player) => player.id === currentUser.id)) {
    return players;
  }

  return [
    ...players,
    {
      ...detailForStudent(currentUser, players.length + 1),
      rank: players.length + 1
    }
  ];
}

function visiblePlayer(player: PlayerDetail, currentUser: Student) {
  return currentUser.role === "admin" || currentUser.role === "officer" || player.id === currentUser.id
    ? player
    : { ...player, email: "", pointHistory: [] };
}

function visibleTeams(teams: TeamComparison[], currentUser: Student) {
  return teams.map((team) => {
    const members = team.members.map((member) => visiblePlayer(member, currentUser));
    const memberById = new Map(members.map((member) => [member.id, member]));
    return {
      ...team,
      members,
      topStudy: team.topStudy ? memberById.get(team.topStudy.id) : undefined,
      topBuild: team.topBuild ? memberById.get(team.topBuild.id) : undefined
    };
  });
}

export async function getDashboardData() {
  const currentUser = await getCurrentUser();
  const analytics = await getAnalyticsForRequest();
  const players = includeCurrentUser(
    analytics.getLeaderboardPlayers(),
    currentUser,
    analytics.detailForStudent
  ).map((player) => visiblePlayer(player, currentUser));

  return {
    currentUser,
    schoolName,
    players,
    activePlayers: [...players].sort((a, b) => b.thirtyDayPoints - a.thirtyDayPoints),
    teams: visibleTeams(analytics.getTeamComparisons(), currentUser)
  };
}

export async function getProfileData(id: string) {
  const currentUser = await getCurrentUser();
  const analytics = await getAnalyticsForRequest();
  const leaderboard = analytics.getLeaderboardPlayers();
  const player =
    analytics.getPlayerDetail(id) ??
    (id === currentUser.id ? analytics.detailForStudent(currentUser, leaderboard.length + 1) : undefined);

  if (!player) {
    notFound();
  }

  return {
    currentUser,
    player: visiblePlayer(player, currentUser)
  };
}

export async function getPointsPageData() {
  const currentUser = await getCurrentUser();
  const analytics = await getAnalyticsForRequest();
  const player = analytics.getPlayerDetail(currentUser.id) ?? analytics.detailForStudent(currentUser);
  return { currentUser, player: visiblePlayer(player, currentUser) };
}

export async function getApprovePageData() {
  const currentUser = await requireRole("officer");
  const analytics = await getAnalyticsForRequest();
  return {
    currentUser,
    queue: analytics.getApprovalQueue().map((entry) => ({
      ...entry,
      student: visiblePlayer(entry.student, currentUser)
    }))
  };
}

export async function getUploadPageData() {
  const currentUser = await requireRole("officer");
  const analytics = await getAnalyticsForRequest();
  return {
    currentUser,
    reference: analytics.getReferenceData()
  };
}

export async function getManagePageData() {
  const currentUser = await requireRole("admin");
  const analytics = await getAnalyticsForRequest();
  return {
    currentUser,
    rosters: analytics.getRosterSeedForDragDrop(),
    teams: analytics.getTeamComparisons(),
    students: analytics.getLeaderboardPlayers()
  };
}

export async function getAuditPageData() {
  const currentUser = await requireRole("admin");
  const analytics = await getAnalyticsForRequest();
  return {
    currentUser,
    logs: analytics.getAuditTrail()
  };
}

export async function getTeamsPageData() {
  const currentUser = await getCurrentUser();
  const analytics = await getAnalyticsForRequest();
  return {
    currentUser,
    teams: visibleTeams(analytics.getTeamComparisons(), currentUser)
  };
}
