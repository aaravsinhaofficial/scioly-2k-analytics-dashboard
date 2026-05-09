import { notFound, redirect } from "next/navigation";
import { getAuthenticatedStudent } from "@/lib/auth";
import {
  getApprovalQueue,
  getAuditTrail,
  getCurrentDemoUser,
  detailForStudent,
  getLeaderboardPlayers,
  getMostActivePlayers,
  getPlayerDetail,
  getReferenceData,
  getRosterSeedForDragDrop,
  getTeamComparisons
} from "@/lib/analytics";
import { schoolName } from "@/lib/seed";
import { roleMeets } from "@/lib/utils";
import type { PlayerDetail, Student, UserRole } from "@/lib/types";

export async function getCurrentUser() {
  const authenticatedStudent = await getAuthenticatedStudent();
  if (authenticatedStudent) {
    return authenticatedStudent;
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login");
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

function includeCurrentUser(players: PlayerDetail[], currentUser: Student) {
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

export async function getDashboardData() {
  const currentUser = await getCurrentUser();
  const players = includeCurrentUser(getLeaderboardPlayers(), currentUser);

  return {
    currentUser,
    schoolName,
    players,
    activePlayers: getMostActivePlayers(),
    teams: getTeamComparisons()
  };
}

export async function getProfileData(id: string) {
  const currentUser = await getCurrentUser();
  const player =
    getPlayerDetail(id) ??
    (id === currentUser.id ? detailForStudent(currentUser, getLeaderboardPlayers().length + 1) : undefined);

  if (!player) {
    notFound();
  }

  return {
    currentUser,
    player
  };
}

export async function getApprovePageData() {
  const currentUser = await requireRole("officer");
  return {
    currentUser,
    queue: getApprovalQueue()
  };
}

export async function getUploadPageData() {
  const currentUser = await requireRole("officer");
  return {
    currentUser,
    reference: getReferenceData()
  };
}

export async function getManagePageData() {
  const currentUser = await requireRole("admin");
  return {
    currentUser,
    rosters: getRosterSeedForDragDrop(),
    teams: getTeamComparisons()
  };
}

export async function getAuditPageData() {
  const currentUser = await requireRole("admin");
  return {
    currentUser,
    logs: getAuditTrail()
  };
}

export async function getTeamsPageData() {
  const currentUser = await getCurrentUser();
  return {
    currentUser,
    teams: getTeamComparisons()
  };
}
