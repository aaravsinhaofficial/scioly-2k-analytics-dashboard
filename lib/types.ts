export type UserRole = "viewer" | "officer" | "admin";

export type EventCategory = "study" | "build";

export type PointLogStatus = "pending" | "approved" | "rejected";

export type ActivityType =
  | "solo_study"
  | "partner_study"
  | "solo_practice_test"
  | "partner_practice_test"
  | "build_testing"
  | "id_specimens";

export interface Student {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  grade: number;
  profilePictureUrl?: string;
  ovrRating: number;
  studyRating?: number;
  buildRating?: number;
  totalPoints: number;
  prevOvr: number;
  prevAvgPlacement?: number;
  lastSnapshotDate?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  schoolName: string;
  teamDesignation: string;
  teamOvr: number;
  version: number;
}

export interface TeamMember {
  teamId: string;
  studentId: string;
}

export interface EventDefinition {
  id: number;
  name: string;
  category: EventCategory;
}

export interface SchoolElo {
  schoolName: string;
  elo: number;
}

export interface BenchmarkComparison {
  benchmarkSchool: string;
  benchmarkElo: number;
  benchmarkTier: "national" | "state" | "regional" | "local";
  source: "direct" | "equivalent";
  relativeDifficultyMultiplier: number;
  strongestAttendingSchool?: string;
  strongestAttendingElo?: number;
  explanation: string;
}

export interface Tournament {
  id: number;
  name: string;
  date: string;
  avgSciolyElo: number;
  sosMultiplier: number;
  benchmarkComparison: BenchmarkComparison;
  attendingSchools: SchoolElo[];
}

export interface Performance {
  id: number;
  studentId: string;
  tournamentId: number;
  eventId: number;
  eventCategory?: EventCategory;
  rank: number;
  placementScore: number;
  teamDesignation: string;
  createdAt: string;
}

export interface GrindPointLog {
  id: number;
  studentId: string;
  activityType: ActivityType;
  points: number;
  minutes: number;
  quantity?: number;
  status: PointLogStatus;
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
}

export interface OvrSnapshot {
  id: number;
  studentId: string;
  ovrValue: number;
  totalPoints: number;
  avgPlacement?: number;
  recordedAt: string;
}

export interface AuditLogEntry {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  reason?: string;
  ipAddress: string;
  createdAt: string;
}

export interface RatingTier {
  name: string;
  min: number;
  max: number;
  color: string;
  className: string;
  glow: boolean;
}

export interface DeltaValue {
  value: number;
  direction: "up" | "down" | "flat";
  isGood: boolean;
}

export interface CompetitionHistoryRow {
  id: number;
  date: string;
  tournament: string;
  event: string;
  category: EventCategory;
  rank: number;
  sos: number;
  benchmarkSchool: string;
  benchmarkSource: BenchmarkComparison["source"];
  relativeDifficultyMultiplier: number;
  placementScore: number;
}

export interface PointHistoryRow {
  id: number;
  date: string;
  activity: string;
  points: number;
  status: PointLogStatus;
  approvedBy?: string;
  notes?: string;
}

export interface EventBreakdown {
  eventId: number;
  eventName: string;
  category: EventCategory;
  timesCompeted: number;
  avgPlacement: number;
  eventOvr: number;
  bestFinish: number;
}

export interface PlayerDetail extends Student {
  rank: number;
  teamId?: string;
  teamName: string;
  teamDesignation: string;
  avgPlacement?: number;
  tournamentsAttended: number;
  thirtyDayPoints: number;
  ovrDelta: DeltaValue;
  avgPlacementDelta?: DeltaValue;
  totalPointsDelta: DeltaValue;
  competitionHistory: CompetitionHistoryRow[];
  pointHistory: PointHistoryRow[];
  eventBreakdowns: EventBreakdown[];
  snapshots: OvrSnapshot[];
}

export interface TeamComparison {
  id: string;
  schoolName: string;
  designation: string;
  teamOvr: number;
  members: PlayerDetail[];
  topStudy?: PlayerDetail;
  topBuild?: PlayerDetail;
  lastSos?: number;
}

export interface TournamentImportPerformance {
  studentName: string;
  eventName: string;
  category: EventCategory;
  rank: number;
  teamDesignation: string;
}

export interface TournamentImportPreview {
  tournamentName: string;
  date: string;
  attendingSchools: SchoolElo[];
  sosMultiplier: number;
  avgSciolyElo: number;
  benchmarkComparison: BenchmarkComparison;
  performances: TournamentImportPerformance[];
  warnings: string[];
  missingFields: string[];
}
