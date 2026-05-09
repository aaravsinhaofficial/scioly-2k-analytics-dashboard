import {
  mockAuditLogs,
  mockEvents,
  mockPerformances,
  mockPointLogs,
  mockSnapshots,
  mockStudents,
  mockTeamMembers,
  mockTeams,
  mockTournaments,
  demoNow
} from "@/lib/seed";
import { activityLabels } from "@/lib/activity";
import {
  calculateAveragePlacement,
  deltaValue,
  getRatingTier,
  roundRating
} from "@/lib/rating";
import type {
  AuditLogEntry,
  CompetitionHistoryRow,
  EventBreakdown,
  EventDefinition,
  GrindPointLog,
  OvrSnapshot,
  Performance,
  PlayerDetail,
  PointHistoryRow,
  Student,
  TeamComparison,
  Tournament
} from "@/lib/types";

const studentById = new Map(mockStudents.map((student) => [student.id, student]));
const eventById = new Map(mockEvents.map((event) => [event.id, event]));
const tournamentById = new Map(mockTournaments.map((tournament) => [tournament.id, tournament]));
const teamById = new Map(mockTeams.map((team) => [team.id, team]));

function approvedLogsFor(studentId: string) {
  return mockPointLogs.filter((log) => log.studentId === studentId && log.status === "approved");
}

function thirtyDayPoints(logs: GrindPointLog[]) {
  const start = new Date(demoNow);
  start.setDate(start.getDate() - 30);

  return logs
    .filter((log) => new Date(log.submittedAt) >= start && log.status === "approved")
    .reduce((total, log) => total + log.points, 0);
}

function getTeamForStudent(studentId: string) {
  const membership = mockTeamMembers.find((member) => member.studentId === studentId);
  const team = membership ? teamById.get(membership.teamId) : undefined;

  return {
    teamId: team?.id,
    teamName: team ? `${team.schoolName} ${team.teamDesignation}` : "Unassigned",
    teamDesignation: team?.teamDesignation ?? "-"
  };
}

function competitionHistory(performances: Performance[]): CompetitionHistoryRow[] {
  return performances
    .map((performance) => {
      const tournament = tournamentById.get(performance.tournamentId)!;
      const event = eventById.get(performance.eventId)!;
      return {
        id: performance.id,
        date: tournament.date,
        tournament: tournament.name,
        event: event.name,
        category: event.category,
        rank: performance.rank,
        sos: tournament.sosMultiplier,
        benchmarkSchool: tournament.benchmarkComparison.benchmarkSchool,
        benchmarkSource: tournament.benchmarkComparison.source,
        relativeDifficultyMultiplier: tournament.benchmarkComparison.relativeDifficultyMultiplier,
        placementScore: performance.placementScore
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function pointHistory(logs: GrindPointLog[]): PointHistoryRow[] {
  return logs
    .map((log) => ({
      id: log.id,
      date: log.submittedAt,
      activity: activityLabels[log.activityType],
      points: log.points,
      status: log.status,
      approvedBy: log.approvedBy ? studentById.get(log.approvedBy)?.name : undefined,
      notes: log.notes
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function eventBreakdowns(performances: Performance[]): EventBreakdown[] {
  const grouped = new Map<number, Performance[]>();
  for (const performance of performances) {
    const list = grouped.get(performance.eventId) ?? [];
    list.push(performance);
    grouped.set(performance.eventId, list);
  }

  return Array.from(grouped.entries())
    .map(([eventId, rows]) => {
      const event = eventById.get(eventId)!;
      const avgPlacement = calculateAveragePlacement(rows) ?? 0;
      const averageScore = rows.reduce((total, row) => total + row.placementScore, 0) / rows.length;

      return {
        eventId,
        eventName: event.name,
        category: event.category,
        timesCompeted: rows.length,
        avgPlacement,
        eventOvr: Math.min(99, Math.max(60, roundRating(55 + averageScore / 4 + rows.length * 0.4))),
        bestFinish: Math.min(...rows.map((row) => row.rank))
      };
    })
    .sort((a, b) => b.eventOvr - a.eventOvr);
}

function snapshotsFor(studentId: string) {
  return mockSnapshots
    .filter((snapshot) => snapshot.studentId === studentId)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

function latestSnapshot(snapshots: OvrSnapshot[]) {
  return snapshots.at(-1);
}

export function detailForStudent(student: Student, rank = 1): PlayerDetail {
  const performances = mockPerformances.filter((performance) => performance.studentId === student.id);
  const allLogs = mockPointLogs.filter((log) => log.studentId === student.id);
  const approvedLogs = approvedLogsFor(student.id);
  const snapshots = snapshotsFor(student.id);
  const snapshot = latestSnapshot(snapshots);
  const team = getTeamForStudent(student.id);
  const avgPlacement = calculateAveragePlacement(performances);
  const tournamentsAttended = new Set(performances.map((performance) => performance.tournamentId)).size;

  return {
    ...student,
    rank,
    ...team,
    avgPlacement,
    tournamentsAttended,
    thirtyDayPoints: thirtyDayPoints(approvedLogs),
    ovrDelta: deltaValue(student.ovrRating, snapshot?.ovrValue ?? student.prevOvr),
    avgPlacementDelta:
      typeof avgPlacement === "number"
        ? deltaValue(avgPlacement, snapshot?.avgPlacement ?? student.prevAvgPlacement, true)
        : undefined,
    totalPointsDelta: deltaValue(student.totalPoints, snapshot?.totalPoints),
    competitionHistory: competitionHistory(performances),
    pointHistory: pointHistory(allLogs),
    eventBreakdowns: eventBreakdowns(performances),
    snapshots
  };
}

export function getLeaderboardPlayers() {
  return mockStudents
    .map((student) => detailForStudent(student))
    .sort((a, b) => b.ovrRating - a.ovrRating)
    .map((student, index) => ({
      ...student,
      rank: index + 1
    }));
}

export function getPlayerDetail(id: string) {
  return getLeaderboardPlayers().find((student) => student.id === id);
}

export function getCurrentDemoUser() {
  return mockStudents.find((student) => student.id === "stu-samanyu")!;
}

export function getApprovalQueue() {
  const players = getLeaderboardPlayers();
  const playersById = new Map(players.map((player) => [player.id, player]));

  return mockPointLogs
    .filter((log) => log.status === "pending")
    .map((log) => ({
      ...log,
      student: playersById.get(log.studentId)!
    }))
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
}

export function calculateTeamOvr(members: PlayerDetail[]) {
  const topMembers = [...members].sort((a, b) => b.ovrRating - a.ovrRating).slice(0, 15);
  const fillerCount = Math.max(0, 15 - topMembers.length);
  const total = topMembers.reduce((sum, member) => sum + member.ovrRating, 0) + fillerCount * 60;
  return roundRating(total / 15);
}

export function getTeamComparisons(): TeamComparison[] {
  const players = getLeaderboardPlayers();
  const playerById = new Map(players.map((player) => [player.id, player]));

  return mockTeams.map((team) => {
    const members = mockTeamMembers
      .filter((member) => member.teamId === team.id)
      .map((member) => playerById.get(member.studentId))
      .filter(Boolean) as PlayerDetail[];

    const memberPerformances = mockPerformances.filter((performance) =>
      members.some((member) => member.id === performance.studentId)
    );
    const latestPerformance = [...memberPerformances].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    const latestTournament = latestPerformance ? tournamentById.get(latestPerformance.tournamentId) : undefined;

    return {
      id: team.id,
      schoolName: team.schoolName,
      designation: team.teamDesignation,
      teamOvr: calculateTeamOvr(members),
      members,
      topStudy: [...members]
        .filter((member) => typeof member.studyRating === "number")
        .sort((a, b) => (b.studyRating ?? 0) - (a.studyRating ?? 0))[0],
      topBuild: [...members]
        .filter((member) => typeof member.buildRating === "number")
        .sort((a, b) => (b.buildRating ?? 0) - (a.buildRating ?? 0))[0],
      lastSos: latestTournament?.sosMultiplier
    };
  });
}

export function getMostActivePlayers() {
  return [...getLeaderboardPlayers()].sort((a, b) => b.thirtyDayPoints - a.thirtyDayPoints);
}

export function getAuditTrail(): AuditLogEntry[] {
  return [...mockAuditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getReferenceData(): {
  events: EventDefinition[];
  tournaments: Tournament[];
  pendingLogs: ReturnType<typeof getApprovalQueue>;
} {
  return {
    events: mockEvents,
    tournaments: mockTournaments,
    pendingLogs: getApprovalQueue()
  };
}

export function getRosterSeedForDragDrop() {
  return getTeamComparisons().map((team) => ({
    id: team.id,
    label: `${team.schoolName} ${team.designation}`,
    ovr: team.teamOvr,
    members: team.members.map((member) => ({
      id: member.id,
      name: member.name,
      ovr: member.ovrRating,
      tier: getRatingTier(member.ovrRating).name
    }))
  }));
}
