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
  /** Legacy database rating retained for backward-compatible reads. */
  ovrRating: number;
  studyRating?: number;
  buildRating?: number;
  potentialRating?: number;
  totalPoints: number;
  profileEvents?: string[];
  /** Admin-only account state. Archived students are excluded from active workflows. */
  isArchived?: boolean;
  prevOvr: number;
  prevAvgPlacement?: number;
  lastSnapshotDate?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name?: string;
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
  eventReadiness: number;
  bestFinish: number;
  medals: number;
  participationPoints: number;
}

export interface TournamentEventSummary {
  eventId: number;
  eventName: string;
  category: EventCategory;
  resultCount: number;
  tournamentCount: number;
  avgPlacement: number;
  bestFinish: number;
  medals: number;
  totalEventPoints: number;
  teamDesignations: string[];
  participantNames: string[];
}

export interface TournamentPartnershipSummary {
  participantNames: string[];
  participantIds: string[];
  eventNames: string[];
  resultCount: number;
  tournamentCount: number;
  avgPlacement: number;
  bestFinish: number;
  medals: number;
  totalEventPoints: number;
}

export interface TournamentResultInsights {
  uniqueResultCount: number;
  eventSummaries: TournamentEventSummary[];
  partnershipSummaries: TournamentPartnershipSummary[];
}

export interface PlayerDetail extends Student {
  rank: number;
  teamId?: string;
  teamName: string;
  teamDesignation: string;
  avgPlacement?: number;
  tournamentsAttended: number;
  medalCount: number;
  readinessScore: number;
  competitionScore: number;
  testoffScore: number;
  preparationScore: number;
  readinessIsProvisional: boolean;
  readinessConfidence: "low" | "medium" | "high";
  readinessStatus: "Needs data" | "Developing" | "On track" | "Ready";
  readinessResultCount: number;
  approvedPracticePoints: number;
  pendingPracticePoints: number;
  competitionPoints: number;
  thirtyDayPoints: number;
  avgPlacementDelta?: DeltaValue;
  totalPointsDelta: DeltaValue;
  competitionHistory: CompetitionHistoryRow[];
  pointHistory: PointHistoryRow[];
  eventBreakdowns: EventBreakdown[];
  snapshots: OvrSnapshot[];
}

export interface TeamComparison {
  id: string;
  name?: string;
  schoolName: string;
  designation: string;
  teamReadiness: number;
  members: PlayerDetail[];
  topStudy?: PlayerDetail;
  topBuild?: PlayerDetail;
  lastSos?: number;
}

export interface TournamentImportPerformance {
  rowKey: string;
  sourceRow?: number;
  rawParticipantText: string;
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
  participantResolution?: {
    status: "matched" | "needs_confirmation" | "unresolved" | "external";
    method: "provided_exact" | "roster_event_suggestion" | "manual_override" | "none";
    selected: TournamentParticipantCandidate[];
    candidates: TournamentParticipantCandidate[];
    unmatchedSourceNames: string[];
    issues: string[];
  };
}

export interface TournamentParticipantCandidate {
  id: string;
  name: string;
  teamDesignation: string;
  profileEvents: string[];
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
  blockers: string[];
  canCommit: boolean;
}

export interface TestoffSeason {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface TestoffStudentOption {
  id: string;
  name: string;
  grade: number;
}

export interface TestoffEventOption {
  /** Stable form value. Catalog values stay stable before and after their DB row is created. */
  value: string;
  id?: number;
  name: string;
  category: EventCategory;
  isCurrentSeason: boolean;
  isTrial: boolean;
}

export interface TestoffResult {
  id: number;
  sessionId: number;
  studentId: string;
  studentName: string;
  rawScore: number;
  rank: number;
  rankingScore: number;
  notes?: string;
}

export interface TestoffSessionDetail {
  id: number;
  seasonId: number;
  eventId: number;
  name: string;
  date: string;
  maxScore: number;
  weight: number;
  notes?: string;
  results: TestoffResult[];
}

export interface TestoffCompositeRanking {
  rank: number;
  studentId: string;
  studentName: string;
  compositeScore: number;
  weightedScore: number;
  completedSessions: number;
  totalSessions: number;
}

export interface TestoffEventRanking {
  seasonId: number;
  seasonName: string;
  eventId: number;
  eventName: string;
  eventCategory: EventCategory;
  totalWeight: number;
  sessions: TestoffSessionDetail[];
  rankings: TestoffCompositeRanking[];
}

export interface TestoffDashboardData {
  configured: boolean;
  activeSeasonId?: number;
  seasons: TestoffSeason[];
  eventRankings: TestoffEventRanking[];
}

export interface TestoffAdminData {
  configured: boolean;
  activeSeasonId?: number;
  seasons: TestoffSeason[];
  events: TestoffEventOption[];
  students: TestoffStudentOption[];
}
