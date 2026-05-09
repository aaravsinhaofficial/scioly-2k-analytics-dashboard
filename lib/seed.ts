import type {
  AuditLogEntry,
  EventDefinition,
  GrindPointLog,
  OvrSnapshot,
  Performance,
  SchoolElo,
  Student,
  Team,
  TeamMember
} from "@/lib/types";
import { calculatePlacementScore, resolveBenchmarkComparison } from "@/lib/rating";

export const schoolName = process.env.NEXT_PUBLIC_SCHOOL_NAME || "Obra D Tompkins High School";

export const demoNow = new Date("2026-05-08T12:00:00-05:00");

export const mockEvents: EventDefinition[] = [
  { id: 1, name: "Anatomy & Physiology", category: "study" },
  { id: 2, name: "Disease Detectives", category: "study" },
  { id: 3, name: "Chemistry Lab", category: "study" },
  { id: 4, name: "Codebusters", category: "study" },
  { id: 5, name: "Astronomy", category: "study" },
  { id: 6, name: "Fossils", category: "study" },
  { id: 7, name: "Tower", category: "build" },
  { id: 8, name: "Robot Tour", category: "build" },
  { id: 9, name: "Wind Power", category: "build" },
  { id: 10, name: "Experimental Design", category: "build" }
];

const schools: SchoolElo[] = [
  { schoolName, elo: 1785 },
  { schoolName: "Seven Lakes High School", elo: 2100 },
  { schoolName: "Solon High School", elo: 2250 },
  { schoolName: "Mason High School", elo: 2185 },
  { schoolName: "Clements High School", elo: 1860 },
  { schoolName: "Cinco Ranch High School", elo: 1725 },
  { schoolName: "LASA High School", elo: 1940 },
  { schoolName: "Westlake High School", elo: 1810 },
  { schoolName: "Cy Falls High School", elo: 1510 },
  { schoolName: "Dulles High School", elo: 1435 },
  { schoolName: "Cypress Ranch High School", elo: 1490 },
  { schoolName: "Pearland High School", elo: 1375 }
];

const mitSchools = schools.slice(0, 8);
const utSchools = [schools[0], schools[4], schools[5], schools[6], schools[7], schools[10]];
const regionalSchools = [schools[0], schools[8], schools[9], schools[10], schools[11]];
const stateSchools = schools;

export const mockTournaments = [
  {
    id: 1,
    name: "MIT Invitational",
    date: "2026-01-25",
    avgSciolyElo: 1830,
    sosMultiplier: 1.83,
    benchmarkComparison: resolveBenchmarkComparison(mitSchools, 1830, 1.83),
    attendingSchools: mitSchools
  },
  {
    id: 2,
    name: "UT Austin Invitational",
    date: "2026-02-15",
    avgSciolyElo: 1460,
    sosMultiplier: 1.46,
    benchmarkComparison: resolveBenchmarkComparison(utSchools, 1460, 1.46),
    attendingSchools: utSchools
  },
  {
    id: 3,
    name: "Cy Falls Regional",
    date: "2026-03-08",
    avgSciolyElo: 1120,
    sosMultiplier: 1.12,
    benchmarkComparison: resolveBenchmarkComparison(regionalSchools, 1120, 1.12),
    attendingSchools: regionalSchools
  },
  {
    id: 4,
    name: "Texas State Tournament",
    date: "2026-04-19",
    avgSciolyElo: 1670,
    sosMultiplier: 1.67,
    benchmarkComparison: resolveBenchmarkComparison(stateSchools, 1670, 1.67),
    attendingSchools: stateSchools
  }
];

export const mockTeams: Team[] = [
  { id: "team-a", schoolName, teamDesignation: "A", teamOvr: 0, version: 4 },
  { id: "team-b", schoolName, teamDesignation: "B", teamOvr: 0, version: 2 },
  { id: "team-c", schoolName, teamDesignation: "C", teamOvr: 0, version: 1 }
];

export const mockStudents: Student[] = [
  {
    id: "stu-samanyu",
    name: "Samanyu Pochanapeddi",
    email: "samanyu@example.com",
    role: "admin",
    grade: 12,
    ovrRating: 91.4,
    studyRating: 94,
    buildRating: 87,
    totalPoints: 1480,
    prevOvr: 89.8,
    prevAvgPlacement: 4.2,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-08-12T12:00:00.000Z"
  },
  {
    id: "stu-maya",
    name: "Maya Iyer",
    email: "maya@example.com",
    role: "officer",
    grade: 11,
    ovrRating: 88.6,
    studyRating: 91,
    buildRating: 84,
    totalPoints: 1225,
    prevOvr: 87.2,
    prevAvgPlacement: 5.4,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-08-14T12:00:00.000Z"
  },
  {
    id: "stu-aarav",
    name: "Aarav Shah",
    email: "aarav@example.com",
    role: "viewer",
    grade: 10,
    ovrRating: 85.1,
    studyRating: 90,
    buildRating: undefined,
    totalPoints: 1040,
    prevOvr: 83.7,
    prevAvgPlacement: 6.1,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-08-17T12:00:00.000Z"
  },
  {
    id: "stu-nisha",
    name: "Nisha Patel",
    email: "nisha@example.com",
    role: "viewer",
    grade: 12,
    ovrRating: 83.9,
    studyRating: 82,
    buildRating: 90,
    totalPoints: 1010,
    prevOvr: 82.4,
    prevAvgPlacement: 5.9,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-08-19T12:00:00.000Z"
  },
  {
    id: "stu-leo",
    name: "Leo Chen",
    email: "leo@example.com",
    role: "viewer",
    grade: 11,
    ovrRating: 81.7,
    studyRating: 86,
    buildRating: 79,
    totalPoints: 920,
    prevOvr: 80.9,
    prevAvgPlacement: 7.2,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-08-20T12:00:00.000Z"
  },
  {
    id: "stu-priya",
    name: "Priya Raman",
    email: "priya@example.com",
    role: "viewer",
    grade: 10,
    ovrRating: 79.5,
    studyRating: 84,
    buildRating: undefined,
    totalPoints: 740,
    prevOvr: 78.8,
    prevAvgPlacement: 8.1,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-08-21T12:00:00.000Z"
  },
  {
    id: "stu-ethan",
    name: "Ethan Morales",
    email: "ethan@example.com",
    role: "viewer",
    grade: 9,
    ovrRating: 77.9,
    studyRating: undefined,
    buildRating: 88,
    totalPoints: 640,
    prevOvr: 76.1,
    prevAvgPlacement: 8.9,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-09-02T12:00:00.000Z"
  },
  {
    id: "stu-sophia",
    name: "Sophia Nguyen",
    email: "sophia@example.com",
    role: "viewer",
    grade: 11,
    ovrRating: 76.6,
    studyRating: 80,
    buildRating: 76,
    totalPoints: 690,
    prevOvr: 76.9,
    prevAvgPlacement: 9.3,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-09-06T12:00:00.000Z"
  },
  {
    id: "stu-rian",
    name: "Rian Gupta",
    email: "rian@example.com",
    role: "viewer",
    grade: 10,
    ovrRating: 74.8,
    studyRating: 78,
    buildRating: undefined,
    totalPoints: 520,
    prevOvr: 73.4,
    prevAvgPlacement: 10.5,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-09-08T12:00:00.000Z"
  },
  {
    id: "stu-emma",
    name: "Emma Brooks",
    email: "emma@example.com",
    role: "viewer",
    grade: 9,
    ovrRating: 72.2,
    studyRating: undefined,
    buildRating: undefined,
    totalPoints: 1220,
    prevOvr: 71.1,
    prevAvgPlacement: undefined,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-09-09T12:00:00.000Z"
  },
  {
    id: "stu-omar",
    name: "Omar Haddad",
    email: "omar@example.com",
    role: "viewer",
    grade: 12,
    ovrRating: 71.8,
    studyRating: 72,
    buildRating: 71,
    totalPoints: 360,
    prevOvr: 72.5,
    prevAvgPlacement: 11.1,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-09-10T12:00:00.000Z"
  },
  {
    id: "stu-claire",
    name: "Claire Park",
    email: "claire@example.com",
    role: "viewer",
    grade: 10,
    ovrRating: 68.9,
    studyRating: undefined,
    buildRating: undefined,
    totalPoints: 890,
    prevOvr: 68.3,
    prevAvgPlacement: undefined,
    lastSnapshotDate: "2026-05-03T05:00:00.000Z",
    createdAt: "2025-09-11T12:00:00.000Z"
  }
];

export const mockTeamMembers: TeamMember[] = [
  { teamId: "team-a", studentId: "stu-samanyu" },
  { teamId: "team-a", studentId: "stu-maya" },
  { teamId: "team-a", studentId: "stu-aarav" },
  { teamId: "team-a", studentId: "stu-nisha" },
  { teamId: "team-a", studentId: "stu-leo" },
  { teamId: "team-b", studentId: "stu-priya" },
  { teamId: "team-b", studentId: "stu-ethan" },
  { teamId: "team-b", studentId: "stu-sophia" },
  { teamId: "team-b", studentId: "stu-rian" },
  { teamId: "team-c", studentId: "stu-emma" },
  { teamId: "team-c", studentId: "stu-omar" },
  { teamId: "team-c", studentId: "stu-claire" }
];

let performanceId = 1;
function perf(
  studentId: string,
  tournamentId: number,
  eventId: number,
  rank: number,
  teamDesignation: string
): Performance {
  const tournament = mockTournaments.find((entry) => entry.id === tournamentId)!;
  const event = mockEvents.find((entry) => entry.id === eventId)!;
  return {
    id: performanceId++,
    studentId,
    tournamentId,
    eventId,
    eventCategory: event.category,
    rank,
    placementScore: calculatePlacementScore(
      rank,
      tournament.sosMultiplier,
      tournament.benchmarkComparison.relativeDifficultyMultiplier
    ),
    teamDesignation,
    createdAt: `${tournament.date}T18:00:00.000Z`
  };
}

export const mockPerformances: Performance[] = [
  perf("stu-samanyu", 1, 1, 4, "A"),
  perf("stu-samanyu", 1, 4, 3, "A"),
  perf("stu-samanyu", 2, 8, 5, "A"),
  perf("stu-samanyu", 4, 1, 2, "A"),
  perf("stu-samanyu", 4, 7, 6, "A"),
  perf("stu-maya", 1, 2, 6, "A"),
  perf("stu-maya", 2, 3, 4, "A"),
  perf("stu-maya", 3, 10, 3, "A"),
  perf("stu-maya", 4, 3, 5, "A"),
  perf("stu-aarav", 1, 5, 8, "A"),
  perf("stu-aarav", 2, 2, 2, "A"),
  perf("stu-aarav", 4, 2, 7, "A"),
  perf("stu-nisha", 2, 7, 4, "A"),
  perf("stu-nisha", 3, 9, 2, "A"),
  perf("stu-nisha", 4, 7, 4, "A"),
  perf("stu-leo", 1, 6, 11, "A"),
  perf("stu-leo", 3, 10, 6, "A"),
  perf("stu-leo", 4, 6, 8, "A"),
  perf("stu-priya", 2, 1, 9, "B"),
  perf("stu-priya", 3, 2, 4, "B"),
  perf("stu-ethan", 3, 8, 5, "B"),
  perf("stu-ethan", 4, 8, 10, "B"),
  perf("stu-sophia", 2, 3, 12, "B"),
  perf("stu-sophia", 3, 9, 8, "B"),
  perf("stu-rian", 3, 4, 7, "B"),
  perf("stu-omar", 2, 6, 14, "C"),
  perf("stu-omar", 3, 10, 12, "C")
];

export const mockPointLogs: GrindPointLog[] = [
  {
    id: 1,
    studentId: "stu-samanyu",
    activityType: "partner_practice_test",
    points: 150,
    minutes: 0,
    status: "approved",
    submittedAt: "2026-04-27T21:12:00.000Z",
    approvedAt: "2026-04-28T13:00:00.000Z",
    approvedBy: "stu-maya"
  },
  {
    id: 2,
    studentId: "stu-samanyu",
    activityType: "solo_study",
    points: 90,
    minutes: 120,
    status: "approved",
    submittedAt: "2026-05-02T20:00:00.000Z",
    approvedAt: "2026-05-03T14:30:00.000Z",
    approvedBy: "stu-maya"
  },
  {
    id: 3,
    studentId: "stu-maya",
    activityType: "build_testing",
    points: 120,
    minutes: 90,
    status: "approved",
    submittedAt: "2026-04-30T23:15:00.000Z",
    approvedAt: "2026-05-01T15:10:00.000Z",
    approvedBy: "stu-samanyu"
  },
  {
    id: 4,
    studentId: "stu-aarav",
    activityType: "partner_study",
    points: 80,
    minutes: 80,
    status: "pending",
    submittedAt: "2026-05-07T00:20:00.000Z"
  },
  {
    id: 5,
    studentId: "stu-nisha",
    activityType: "build_testing",
    points: 140,
    minutes: 110,
    status: "pending",
    submittedAt: "2026-05-07T01:12:00.000Z"
  },
  {
    id: 6,
    studentId: "stu-emma",
    activityType: "solo_practice_test",
    points: 100,
    minutes: 0,
    status: "approved",
    submittedAt: "2026-05-04T22:30:00.000Z",
    approvedAt: "2026-05-05T15:00:00.000Z",
    approvedBy: "stu-maya"
  },
  {
    id: 7,
    studentId: "stu-claire",
    activityType: "id_specimens",
    points: 35,
    minutes: 0,
    quantity: 70,
    status: "rejected",
    submittedAt: "2026-05-05T21:25:00.000Z",
    approvedAt: "2026-05-06T14:05:00.000Z",
    approvedBy: "stu-samanyu",
    notes: "Duplicate of a log from earlier this week."
  },
  {
    id: 8,
    studentId: "stu-priya",
    activityType: "solo_study",
    points: 68,
    minutes: 90,
    status: "approved",
    submittedAt: "2026-04-20T22:10:00.000Z",
    approvedAt: "2026-04-21T13:10:00.000Z",
    approvedBy: "stu-maya"
  },
  {
    id: 9,
    studentId: "stu-ethan",
    activityType: "build_testing",
    points: 95,
    minutes: 75,
    status: "approved",
    submittedAt: "2026-05-01T22:40:00.000Z",
    approvedAt: "2026-05-02T15:10:00.000Z",
    approvedBy: "stu-samanyu"
  },
  {
    id: 10,
    studentId: "stu-sophia",
    activityType: "partner_study",
    points: 60,
    minutes: 60,
    status: "approved",
    submittedAt: "2026-04-17T21:00:00.000Z",
    approvedAt: "2026-04-18T14:00:00.000Z",
    approvedBy: "stu-maya"
  }
];

let snapshotId = 1;
function snapshotSeries(
  studentId: string,
  ovrValues: number[],
  pointValues: number[],
  placementValues: Array<number | undefined>
): OvrSnapshot[] {
  const dates = ["2026-04-12", "2026-04-19", "2026-04-26", "2026-05-03"];
  return dates.map((date, index) => ({
    id: snapshotId++,
    studentId,
    ovrValue: ovrValues[index],
    totalPoints: pointValues[index],
    avgPlacement: placementValues[index],
    recordedAt: `${date}T05:00:00.000Z`
  }));
}

export const mockSnapshots: OvrSnapshot[] = [
  ...snapshotSeries("stu-samanyu", [86.9, 88.4, 89.8, 91.4], [980, 1120, 1320, 1480], [5.8, 5.1, 4.2, 4]),
  ...snapshotSeries("stu-maya", [84.1, 85.6, 87.2, 88.6], [870, 990, 1110, 1225], [6.6, 6.1, 5.4, 4.5]),
  ...snapshotSeries("stu-aarav", [80.5, 82.2, 83.7, 85.1], [720, 850, 960, 1040], [7.9, 6.8, 6.1, 5.7]),
  ...snapshotSeries("stu-nisha", [80.9, 81.8, 82.4, 83.9], [710, 825, 900, 1010], [7.6, 6.7, 5.9, 4.7]),
  ...snapshotSeries("stu-leo", [79.2, 80.1, 80.9, 81.7], [710, 790, 850, 920], [8.4, 7.9, 7.2, 8.3]),
  ...snapshotSeries("stu-priya", [76.9, 77.6, 78.8, 79.5], [520, 610, 672, 740], [9.8, 8.9, 8.1, 6.5]),
  ...snapshotSeries("stu-ethan", [73.4, 74.9, 76.1, 77.9], [390, 480, 545, 640], [10.5, 9.7, 8.9, 7.5]),
  ...snapshotSeries("stu-sophia", [76.1, 76.4, 76.9, 76.6], [560, 620, 690, 690], [9.8, 9.4, 9.3, 10]),
  ...snapshotSeries("stu-rian", [70.7, 72.0, 73.4, 74.8], [330, 410, 465, 520], [12.5, 11.6, 10.5, 7]),
  ...snapshotSeries("stu-emma", [66.8, 69.1, 71.1, 72.2], [680, 910, 1110, 1220], [undefined, undefined, undefined, undefined]),
  ...snapshotSeries("stu-omar", [72.9, 72.8, 72.5, 71.8], [280, 320, 350, 360], [10.9, 10.8, 11.1, 13]),
  ...snapshotSeries("stu-claire", [65.3, 66.9, 68.3, 68.9], [530, 690, 820, 890], [undefined, undefined, undefined, undefined])
];

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 1,
    actorId: "stu-samanyu",
    actorName: "Samanyu Pochanapeddi",
    action: "role.assign",
    target: "Maya Iyer -> officer",
    reason: "Competition captain access",
    ipAddress: "127.0.0.1",
    createdAt: "2026-04-14T15:02:00.000Z"
  },
  {
    id: 2,
    actorId: "stu-maya",
    actorName: "Maya Iyer",
    action: "points.approve",
    target: "Samanyu Pochanapeddi +90",
    ipAddress: "127.0.0.1",
    createdAt: "2026-05-03T14:30:00.000Z"
  },
  {
    id: 3,
    actorId: "stu-samanyu",
    actorName: "Samanyu Pochanapeddi",
    action: "points.reject",
    target: "Claire Park +35",
    reason: "Duplicate submission",
    ipAddress: "127.0.0.1",
    createdAt: "2026-05-06T14:05:00.000Z"
  },
  {
    id: 4,
    actorId: "stu-samanyu",
    actorName: "Samanyu Pochanapeddi",
    action: "tournament.import",
    target: "Texas State Tournament",
    reason: "Duosmium import preview committed",
    ipAddress: "127.0.0.1",
    createdAt: "2026-04-19T23:15:00.000Z"
  }
];
