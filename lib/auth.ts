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

const builtInDefaultAdminEmails = ["aarav@example.com", "aaravsinhaofficial@gmail.com"];

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
    prevOvr: 60,
    prevAvgPlacement: undefined,
    createdAt: new Date().toISOString()
  };
}

async function fetchStudentByAuthUser(authUserId: string, email: string) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const byAuthUser = await supabase
    .from("students")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (byAuthUser.data) {
    return studentFromRow(byAuthUser.data as StudentRow);
  }

  const byEmail = await supabase.from("students").select("*").eq("email", email).maybeSingle();
  if (byEmail.data) {
    return studentFromRow(byEmail.data as StudentRow);
  }

  return null;
}

export async function ensureStudentProfile(input: {
  authUserId: string;
  email: string;
  name?: string | null;
  grade?: number | null;
}) {
  const existing = await fetchStudentByAuthUser(input.authUserId, input.email);
  const defaultRole = defaultRoleForEmail(input.email);
  if (existing) {
    if (defaultRole === "admin" && existing.role !== "admin") {
      const admin = getSupabaseAdmin();
      if (admin) {
        const { data } = await admin
          .from("students")
          .update({ role: "admin" })
          .eq("id", existing.id)
          .select("*")
          .single();
        if (data) return studentFromRow(data as StudentRow);
      }
    }
    return existing;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return baselineStudent({
      id: input.authUserId,
      email: input.email,
      name: input.name,
      grade: input.grade,
      role: defaultRole
    });
  }

  const { data, error } = await admin
    .from("students")
    .upsert(
      {
        auth_user_id: input.authUserId,
        email: input.email,
        name: input.name?.trim() || input.email.split("@")[0],
        grade: input.grade ?? null,
        role: defaultRole,
        ovr_rating: 60,
        total_points: 0,
        prev_ovr: 60
      },
      { onConflict: "email" }
    )
    .select("*")
    .single();

  if (error || !data) {
    return baselineStudent({
      id: input.authUserId,
      email: input.email,
      name: input.name,
      grade: input.grade,
      role: defaultRole
    });
  }

  return studentFromRow(data as StudentRow);
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
