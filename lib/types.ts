export type UserRole = "viewer" | "officer" | "admin";

export type EventCategory = "study" | "build";

export type PointLogStatus = "pending" | "approved" | "rejected";

export type ActivityType =
  | "solo_study"
  | "partner_study"
  | "solo_practice_test"
  | "partner_practice_test"
  | "build_testing"
  | "id_specimens"
  | "custom_activity";

export type TournamentSourceType = "duosmium_csv" | "manual" | "demo";

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
  potentialRating?: number;
  totalPoints: number;
  profileEvents?: string[];
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
  medalCutoff: number;
  participationPoints: number;
  sourceType: TournamentSourceType;
}

export interface Performance {
  id: number;
  studentId: string;
  tournamentId: number;
  eventId: number;
  eventCategory?: EventCategory;
  rank: number;
  placementScore: number;
  participantNames: string[];
  isMedal: boolean;
  medalCutoff: number;
  participationPoints: number;
  medalPoints: number;
  eventPoints: number;
  teamDesignation: string;
  createdAt: string;
}

export interface CustomPointCategory {
  id: number;
  name: string;
  defaultPoints: number;
  maxPoints: number;
  isActive: boolean;
}

export interface GrindPointLog {
  id: number;
  studentId: string;
  activityType: ActivityType;
  points: number;
  minutes: number;
  quantity?: number;
  customLabel?: string;
  customCategoryId?: number;
  status: PointLogStatus;
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface OvrSnapshot {
  id: number;
  studentId: string;
  ovrValue: number;
  totalPoints: number;
  avgPlacement?: number;
  medalCount?: number;
  potentialRating?: number;
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
  entityTable?: string;
  entityId?: string;
  payloadBefore?: Record<string, unknown>;
  payloadAfter?: Record<string, unknown>;
  undoAction?: string;
  isReversible?: boolean;
  isReversed?: boolean;
  reversedAt?: string;
  reversedBy?: string;
  reversalOf?: number;
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
  participantNames: string[];
  isMedal: boolean;
  participationPoints: number;
  medalPoints: number;
  eventPoints: number;
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
  medals: number;
  participationPoints: number;
}

export interface PlayerDetail extends Student {
  rank: number;
  teamId?: string;
  teamName: string;
  teamDesignation: string;
  avgPlacement?: number;
  tournamentsAttended: number;
  medalCount: number;
  potentialRating: number;
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
  studentName?: string;
  studentNames: string[];
  eventName: string;
  category: EventCategory;
  rank: number;
  schoolName: string;
  isMedal: boolean;
  medalCutoff: number;
  participationPoints: number;
  medalPoints: number;
  eventPoints: number;
  teamDesignation: string;
}

export interface TournamentImportPreview {
  tournamentName: string;
  date: string;
  sourceType: TournamentSourceType;
  attendingSchools: SchoolElo[];
  sosMultiplier: number;
  avgSciolyElo: number;
  benchmarkComparison: BenchmarkComparison;
  medalCutoff: number;
  participationPoints: number;
  performances: TournamentImportPerformance[];
  warnings: string[];
  missingFields: string[];
}
