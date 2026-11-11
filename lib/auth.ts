import { redirect } from "next/navigation";
import { getSupabaseAdmin, getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";
import type { PlayerDetail, Student, UserRole } from "@/lib/types";
import { roleMeets } from "@/lib/utils";

interface StudentRow {
  id: string;
  auth_user_id?: string | null;
  name: string;
  email: string;
  role: UserRole;
  grade: number | null;
  profile_picture_url?: string | null;
  ovr_rating: number | string;
  study_rating?: number | null;
  build_rating?: number | null;
  potential_rating?: number | string | null;
  total_points: number;
  profile_events?: string[] | null;
  is_active?: boolean | null;
  prev_ovr?: number | string | null;
  prev_avg_placement?: number | string | null;
  last_snapshot_date?: string | null;
  created_at: string;
}

function numberOrUndefined(value: number | string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const builtInDefaultAdminEmails = ["aaravsinha002@gmail.com"];

export function publicSignupEnabled() {
  return process.env.ALLOW_PUBLIC_SIGNUP === "true";
}

function defaultAdminEmails() {
  return new Set(
    [
      ...builtInDefaultAdminEmails,
      ...(process.env.DEFAULT_ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ].map((email) => email.toLowerCase())
  );
}

function defaultRoleForEmail(email: string): UserRole {
  return defaultAdminEmails().has(email.toLowerCase()) ? "admin" : "viewer";
}

export function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    grade: row.grade ?? 9,
    profilePictureUrl: row.profile_picture_url ?? undefined,
    ovrRating: Number(row.ovr_rating),
    studyRating: row.study_rating ?? undefined,
    buildRating: row.build_rating ?? undefined,
    potentialRating: numberOrUndefined(row.potential_rating),
    totalPoints: row.total_points ?? 0,
    profileEvents: row.profile_events ?? [],
    isArchived: row.is_active === false,
    prevOvr: Number(row.prev_ovr ?? row.ovr_rating ?? 60),
    prevAvgPlacement: numberOrUndefined(row.prev_avg_placement),
    lastSnapshotDate: row.last_snapshot_date ?? undefined,
    createdAt: row.created_at
  };
}

export function baselineStudent(input: {
  id: string;
  email: string;
  name?: string | null;
  grade?: number | null;
  role?: UserRole;
}): Student {
  return {
    id: input.id,
    name: input.name?.trim() || input.email.split("@")[0] || "New Student",
    email: input.email,
    role: input.role ?? "viewer",
    grade: input.grade ?? 9,
    ovrRating: 60,
    studyRating: undefined,
    buildRating: undefined,
    totalPoints: 0,
    profileEvents: [],
    isArchived: false,
    prevOvr: 60,
    prevAvgPlacement: undefined,
    createdAt: new Date().toISOString()
  };
}

async function fetchStudentByAuthUser(authUserId: string, email: string): Promise<{
  row: StudentRow | null;
  failed: boolean;
}> {
  const supabase = getSupabaseAdmin() ?? await getSupabaseServerClient();
  if (!supabase) return { row: null, failed: true };

  const byAuthUser = await supabase
    .from("students")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (byAuthUser.error) return { row: null, failed: true };
  if (byAuthUser.data) return { row: byAuthUser.data as StudentRow, failed: false };

  const byEmail = await supabase.from("students").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (byEmail.error) return { row: null, failed: true };
  if (byEmail.data) return { row: byEmail.data as StudentRow, failed: false };

  return { row: null, failed: false };
}

interface StudentProfileInput {
  authUserId: string;
  email: string;
  name?: string | null;
  grade?: number | null;
  legalAcceptedAt?: string;
  legalVersion?: string;
}

export async function ensureStudentProfile(input: StudentProfileInput): Promise<Student | null> {
  return ensureStudentProfileOnce(input, true);
}

async function ensureStudentProfileOnce(input: StudentProfileInput, allowCreate: boolean): Promise<Student | null> {
  const lookup = await fetchStudentByAuthUser(input.authUserId, input.email);
  // A failed read is not evidence that this user needs a new baseline profile.
  if (lookup.failed) return null;
  const existingRow = lookup.row;
  if (existingRow?.is_active === false) {
    // Archiving is an administrative access decision. A later sign-in or
    // signup may attach its auth ID, but must never silently reactivate it or
    // inherit a legacy elevated profile-only role.
    if (!existingRow.auth_user_id) {
      const admin = getSupabaseAdmin();
      if (admin) {
        await admin
          .from("students")
          .update({
            auth_user_id: input.authUserId,
            role: defaultRoleForEmail(input.email) === "admin" ? "admin" : "viewer"
          })
          .eq("id", existingRow.id)
          .eq("is_active", false);
      }
    }
    return null;
  }
  const existing = existingRow ? studentFromRow(existingRow) : null;
  const defaultRole = defaultRoleForEmail(input.email);
  if (existing) {
    const admin = getSupabaseAdmin();
    const requiresLegalPersistence = Boolean(input.legalAcceptedAt && input.legalVersion);
    const updates: {
      auth_user_id?: string;
      role?: UserRole;
      terms_accepted_at?: string;
      privacy_acknowledged_at?: string;
      legal_version?: string;
    } = {};
    if (!existingRow?.auth_user_id) {
      updates.auth_user_id = input.authUserId;
    }
    if (defaultRole === "admin" && existing.role !== "admin") updates.role = "admin";
    if (input.legalAcceptedAt && input.legalVersion) {
      updates.terms_accepted_at = input.legalAcceptedAt;
      updates.privacy_acknowledged_at = input.legalAcceptedAt;
      updates.legal_version = input.legalVersion;
    }
    if (Object.keys(updates).length > 0) {
      if (!admin) return requiresLegalPersistence ? null : existing;
      const { data, error } = await admin
        .from("students")
        .update(updates)
        .eq("id", existing.id)
        .eq("is_active", true)
        .select("*")
        .single();
      if (!error && data) return studentFromRow(data as StudentRow);
      if (requiresLegalPersistence) return null;
    }
    return existing;
  }

  if (!allowCreate) return null;
  const admin = getSupabaseAdmin();
  if (!admin) {
    // Without the service-role client we cannot distinguish a missing profile
    // from an archived profile hidden by RLS. Fail closed instead of restoring
    // access with a synthetic active profile.
    return null;
  }

  const { data, error } = await admin
    .from("students")
    .upsert(
      {
        auth_user_id: input.authUserId,
        email: input.email.trim().toLowerCase(),
        name: input.name?.trim() || input.email.split("@")[0],
        grade: input.grade ?? null,
        role: defaultRole,
        ovr_rating: 60,
        total_points: 0,
        prev_ovr: 60,
        terms_accepted_at: input.legalAcceptedAt ?? null,
        privacy_acknowledged_at: input.legalAcceptedAt ?? null,
        legal_version: input.legalVersion ?? null
      },
      { onConflict: "email", ignoreDuplicates: true }
    )
    .select("*")
    .maybeSingle();

  if ((!error && !data) || error?.code === "23505") {
    // Another request may have created the profile after our lookup. Read and
    // link that row once instead of overwriting its role, history, or points.
    return ensureStudentProfileOnce(input, false);
  }
  if (error || !data) return null;

  const createdOrLinked = data as StudentRow;
  return createdOrLinked.is_active === false ? null : studentFromRow(createdOrLinked);
}

export async function recordLegalAcceptance(studentId: string, acceptedAt: string, legalVersion: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { data, error } = await admin
    .from("students")
    .update({
      terms_accepted_at: acceptedAt,
      privacy_acknowledged_at: acceptedAt,
      legal_version: legalVersion
    })
    .eq("id", studentId)
    .eq("is_active", true)
    .select("id")
    .maybeSingle();
  return !error && Boolean(data?.id);
}

export async function getAuthenticatedStudent() {
  if (!hasSupabaseConfig()) return null;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return null;
  }

  return ensureStudentProfile({
    authUserId: user.id,
    email: user.email,
    name:
      typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : undefined,
    grade:
      typeof user.user_metadata?.grade === "number"
        ? user.user_metadata.grade
        : Number.isFinite(Number(user.user_metadata?.grade))
          ? Number(user.user_metadata?.grade)
          : undefined
  });
}

export async function redirectIfAuthenticated(target = "/dashboard") {
  const student = await getAuthenticatedStudent();
  if (student) {
    redirect(target);
  }
}

export function requireMinimumRole(student: Student | PlayerDetail, minimumRole: UserRole) {
  return roleMeets(student.role, minimumRole);
}
