import { notFound, redirect } from "next/navigation";
import {
  getApprovalQueue,
  getAuditTrail,
  getCurrentDemoUser,
  getLeaderboardPlayers,
  getMostActivePlayers,
  getPlayerDetail,
  getReferenceData,
  getRosterSeedForDragDrop,
  getTeamComparisons
} from "@/lib/analytics";
import { schoolName } from "@/lib/seed";
import { roleMeets } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

export async function getCurrentUser() {
  return getCurrentDemoUser();
}

export async function requireRole(minimumRole: UserRole) {
  const user = await getCurrentUser();
  if (!roleMeets(user.role, minimumRole)) {
    redirect("/dashboard");
  }
  return user;
}

export async function getDashboardData() {
  const currentUser = await getCurrentUser();
  const players = getLeaderboardPlayers();

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
  const player = getPlayerDetail(id);

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
