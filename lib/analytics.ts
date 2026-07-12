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
  roundRating
} from "@/lib/rating";
import { calculateEventReadiness, calculateReadiness } from "@/lib/readiness";
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
  Team,
  TeamComparison,
  TeamMember,
  Tournament
} from "@/lib/types";

export interface AnalyticsDataset {
  students: Student[];
  teams: Team[];
  teamMembers: TeamMember[];
  events: EventDefinition[];
  tournaments: Tournament[];
  performances: Performance[];
  pointLogs: GrindPointLog[];
  snapshots: OvrSnapshot[];
  auditLogs: AuditLogEntry[];
  testoffScores: Array<{ studentId: string; score: number; weight: number; seasonId: number; isActiveSeason: boolean }>;
  now?: Date;
}

export const demoAnalyticsDataset: AnalyticsDataset = {
  students: mockStudents,
  teams: mockTeams,
  teamMembers: mockTeamMembers,
  events: mockEvents,
  tournaments: mockTournaments,
  performances: mockPerformances,
  pointLogs: mockPointLogs,
  snapshots: mockSnapshots,
  auditLogs: mockAuditLogs,
  testoffScores: [],
  now: demoNow
};

export function createAnalytics(dataset: AnalyticsDataset) {
  const studentById = new Map(dataset.students.map((student) => [student.id, student]));
  const eventById = new Map(dataset.events.map((event) => [event.id, event]));
  const tournamentById = new Map(dataset.tournaments.map((tournament) => [tournament.id, tournament]));
  const teamById = new Map(dataset.teams.map((team) => [team.id, team]));

  function approvedLogsFor(studentId: string) {
    return dataset.pointLogs.filter((log) => log.studentId === studentId && log.status === "approved");
  }

  function thirtyDayPoints(logs: GrindPointLog[]) {
    const start = new Date(dataset.now ?? new Date());
    start.setDate(start.getDate() - 30);

    return logs
      .filter((log) => new Date(log.submittedAt) >= start && log.status === "approved")
      .reduce((total, log) => total + log.points, 0);
  }

  function getTeamForStudent(studentId: string) {
    const membership = dataset.teamMembers.find((member) => member.studentId === studentId);
    const team = membership ? teamById.get(membership.teamId) : undefined;

    return {
      teamId: team?.id,
      teamName: team ? `${team.schoolName} ${team.teamDesignation}` : "Unassigned",
      teamDesignation: team?.teamDesignation ?? "-"
    };
  }

  function competitionHistory(performances: Performance[]): CompetitionHistoryRow[] {
    return performances
      .flatMap((performance) => {
        const tournament = tournamentById.get(performance.tournamentId);
        const event = eventById.get(performance.eventId);
        if (!tournament || !event) return [];

        return [{
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
          placementScore: performance.placementScore,
          participantNames: performance.participantNames,
          isMedal: performance.isMedal,
          participationPoints: performance.participationPoints,
          medalPoints: performance.medalPoints,
          eventPoints: performance.eventPoints
        } satisfies CompetitionHistoryRow];
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  function pointHistory(logs: GrindPointLog[]): PointHistoryRow[] {
    return logs
      .map((log) => ({
        id: log.id,
        date: log.submittedAt,
        activity: log.customLabel || activityLabels[log.activityType] || log.activityType,
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
      .flatMap(([eventId, rows]) => {
        const event = eventById.get(eventId);
        if (!event) return [];
        const avgPlacement = calculateAveragePlacement(rows) ?? 0;
        const readinessPerformances = rows.flatMap((row) => {
          const tournament = tournamentById.get(row.tournamentId);
          return tournament ? [{ eventId: row.eventId, rank: row.rank, date: tournament.date }] : [];
        });

        return [{
          eventId,
          eventName: event.name,
          category: event.category,
          timesCompeted: rows.length,
          avgPlacement,
          eventReadiness: calculateEventReadiness(readinessPerformances),
          bestFinish: Math.min(...rows.map((row) => row.rank)),
          medals: rows.filter((row) => row.isMedal).length,
          participationPoints: rows.reduce((total, row) => total + row.participationPoints, 0)
        } satisfies EventBreakdown];
      })
      .sort((a, b) => b.eventReadiness - a.eventReadiness);
  }

  function snapshotsFor(studentId: string) {
    return dataset.snapshots
      .filter((snapshot) => snapshot.studentId === studentId)
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }

  function detailForStudent(student: Student, rank = 1): PlayerDetail {
    const performances = dataset.performances.filter((performance) => performance.studentId === student.id);
    const allLogs = dataset.pointLogs.filter((log) => log.studentId === student.id);
    const approvedLogs = approvedLogsFor(student.id);
    const approvedPracticePoints = approvedLogs.reduce((total, log) => total + log.points, 0);
    const pendingPracticePoints = allLogs
      .filter((log) => log.status === "pending")
      .reduce((total, log) => total + log.points, 0);
    const competitionPoints = performances.reduce((total, performance) => total + performance.eventPoints, 0);
    const snapshots = snapshotsFor(student.id);
    const snapshot = snapshots.at(-1);
    const team = getTeamForStudent(student.id);
    const avgPlacement = calculateAveragePlacement(performances);
    const tournamentsAttended = new Set(performances.map((performance) => performance.tournamentId)).size;
    const medalCount = performances.filter((performance) => performance.isMedal).length;
    const activePoints = thirtyDayPoints(approvedLogs);
    const readiness = calculateReadiness({
      performances: performances.flatMap((performance) => {
        const tournament = tournamentById.get(performance.tournamentId);
        return tournament ? [{ eventId: performance.eventId, rank: performance.rank, date: tournament.date }] : [];
      }),
      thirtyDayPoints: activePoints,
      testoffScores: dataset.testoffScores
        .filter((score) => score.studentId === student.id && score.isActiveSeason)
        .map((score) => ({ score: score.score, weight: score.weight }))
    });

    return {
      ...student,
      rank,
      ...team,
      avgPlacement,
      tournamentsAttended,
      medalCount,
      ...readiness,
      readinessResultCount: readiness.resultCount,
      approvedPracticePoints,
      pendingPracticePoints,
      competitionPoints,
      thirtyDayPoints: activePoints,
      avgPlacementDelta:
        typeof avgPlacement === "number"
          ? deltaValue(avgPlacement, snapshot?.avgPlacement ?? student.prevAvgPlacement, true)
          : undefined,
      totalPointsDelta: deltaValue(student.totalPoints, snapshot?.totalPoints),
      competitionHistory: competitionHistory(performances),
      pointHistory: pointHistory(allLogs),
      eventBreakdowns: eventBreakdowns(performances),
      snapshots: snapshots.map((entry) => ({
        ...entry,
        medalCount: entry.medalCount ?? medalCount
      }))
    };
  }

  function getLeaderboardPlayers() {
    return dataset.students
      .map((student) => detailForStudent(student))
      .sort((a, b) => b.readinessScore - a.readinessScore || a.name.localeCompare(b.name))
      .map((student, index) => ({ ...student, rank: index + 1 }));
  }

  function getPlayerDetail(id: string) {
    return getLeaderboardPlayers().find((student) => student.id === id);
  }

  function getApprovalQueue() {
    const playersById = new Map(getLeaderboardPlayers().map((player) => [player.id, player]));

    return dataset.pointLogs
      .filter((log) => log.status === "pending")
      .flatMap((log) => {
        const student = playersById.get(log.studentId);
        return student ? [{ ...log, student }] : [];
      })
      .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  }

  function calculateTeamReadiness(members: PlayerDetail[]) {
    const scoredMembers = members.filter((member) => member.readinessScore > 0);
    const topMembers = [...scoredMembers].sort((a, b) => b.readinessScore - a.readinessScore).slice(0, 15);
    if (topMembers.length === 0) return 0;
    return roundRating(topMembers.reduce((sum, member) => sum + member.readinessScore, 0) / topMembers.length);
  }

  function getTeamComparisons(): TeamComparison[] {
    const players = getLeaderboardPlayers();
    const playerById = new Map(players.map((player) => [player.id, player]));

    return dataset.teams.map((team) => {
      const members = dataset.teamMembers
        .filter((member) => member.teamId === team.id)
        .map((member) => playerById.get(member.studentId))
        .filter((member): member is PlayerDetail => Boolean(member));

      const memberIds = new Set(members.map((member) => member.id));
      const memberPerformances = dataset.performances.filter((performance) => memberIds.has(performance.studentId));
      const latestPerformance = [...memberPerformances].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      const latestTournament = latestPerformance ? tournamentById.get(latestPerformance.tournamentId) : undefined;

      return {
        id: team.id,
        schoolName: team.schoolName,
        designation: team.teamDesignation,
        teamReadiness: calculateTeamReadiness(members),
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

  function getAuditTrail() {
    return [...dataset.auditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  function getRosterSeedForDragDrop() {
    const teamRosters = getTeamComparisons().map((team) => ({
      id: team.id,
      label: `${team.schoolName} ${team.designation}`,
      readiness: team.teamReadiness,
      members: team.members.map((member) => ({
        id: member.id,
        name: member.name,
        readiness: member.readinessScore,
        status: member.readinessStatus
      }))
    }));

    const assignedStudentIds = new Set(dataset.teamMembers.map((member) => member.studentId));
    const unassigned = getLeaderboardPlayers()
      .filter((student) => !assignedStudentIds.has(student.id))
      .map((student) => ({
        id: student.id,
        name: student.name,
        readiness: student.readinessScore,
        status: student.readinessStatus
      }));

    return [
      ...teamRosters,
      {
        id: "unassigned",
        label: "Unassigned",
        readiness: 0,
        members: unassigned
      }
    ];
  }

  return {
    detailForStudent,
    getLeaderboardPlayers,
    getPlayerDetail,
    getApprovalQueue,
    getTeamComparisons,
    getMostActivePlayers: () =>
      [...getLeaderboardPlayers()].sort((a, b) => b.thirtyDayPoints - a.thirtyDayPoints),
    getAuditTrail,
    getReferenceData: () => ({
      events: dataset.events,
      tournaments: dataset.tournaments,
      pendingLogs: getApprovalQueue()
    }),
    getRosterSeedForDragDrop
  };
}

const demoAnalytics = createAnalytics(demoAnalyticsDataset);

export const detailForStudent = demoAnalytics.detailForStudent;
export const getLeaderboardPlayers = demoAnalytics.getLeaderboardPlayers;
export const getPlayerDetail = demoAnalytics.getPlayerDetail;
export const getApprovalQueue = demoAnalytics.getApprovalQueue;
export const getTeamComparisons = demoAnalytics.getTeamComparisons;
export const getMostActivePlayers = demoAnalytics.getMostActivePlayers;
export const getAuditTrail = demoAnalytics.getAuditTrail;
export const getReferenceData = demoAnalytics.getReferenceData;
export const getRosterSeedForDragDrop = demoAnalytics.getRosterSeedForDragDrop;

export function getCurrentDemoUser() {
  return mockStudents.find((student) => student.id === "stu-aarav") ?? mockStudents[0];
}
