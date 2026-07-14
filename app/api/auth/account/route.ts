import { NextResponse } from "next/server";
import { invalidateAnalyticsCache } from "@/lib/analytics-cache";
import { getAppOrigin } from "@/lib/app-url";
import { getSupabaseAdmin, getSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;
type SupabaseAdmin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

interface DeletionSnapshot extends DbRow {
  student: DbRow;
  memberships: DbRow[];
  deletion_email: string;
  prepared_at: string;
}

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function hasRecentSessionAuthentication(claims: unknown, userId: string) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) return false;
  const row = claims as DbRow;
  if (row.sub !== userId || typeof row.session_id !== "string" || !Array.isArray(row.amr)) return false;

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - 15 * 60;
  return row.amr.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const method = (entry as DbRow).method;
    const timestamp = (entry as DbRow).timestamp;
    return typeof method === "string" &&
      method !== "token_refresh" &&
      method !== "anonymous" &&
      typeof timestamp === "number" &&
      Number.isFinite(timestamp) &&
      timestamp >= cutoff &&
      timestamp <= now + 60;
  });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || (fetchSite && fetchSite !== "same-origin")) return false;

  try {
    return new URL(origin).origin === getAppOrigin(request);
  } catch {
    return false;
  }
}

function parseSnapshot(value: unknown): DeletionSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as DbRow;
  const student = row.student;
  const memberships = row.memberships;
  if (!student || typeof student !== "object" || Array.isArray(student)) return null;
  if (!Array.isArray(memberships) || memberships.some((entry) => !entry || typeof entry !== "object" || Array.isArray(entry))) {
    return null;
  }
  if (typeof row.deletion_email !== "string" || typeof row.prepared_at !== "string") return null;
  return {
    ...row,
    student: student as DbRow,
    memberships: memberships as DbRow[],
    deletion_email: row.deletion_email,
    prepared_at: row.prepared_at
  } as DeletionSnapshot;
}

async function loadPendingSnapshot(admin: SupabaseAdmin, authUserId: string) {
  try {
    const { data, error } = await admin
      .from("account_deletion_operations")
      .select("snapshot")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    return error ? null : parseSnapshot(data?.snapshot);
  } catch {
    return null;
  }
}

function preparationError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as { code?: string; message?: string } : {};
  const message = candidate.message ?? "";
  if (candidate.code === "PGRST202" || candidate.code === "42883" || message.includes("prepare_self_account_deletion")) {
    return NextResponse.json(
      { ok: false, error: "Account deletion is not installed yet. Run the latest supabase/schema.sql, then try again." },
      { status: 503 }
    );
  }
  if (message.includes("last admin")) {
    return NextResponse.json(
      { ok: false, error: "Add another active admin before deleting the last admin account." },
      { status: 409 }
    );
  }
  if (message.includes("Confirmation email")) {
    return NextResponse.json({ ok: false, error: "The confirmation email does not match your account." }, { status: 400 });
  }
  if (message.includes("already archived or deleted")) {
    return NextResponse.json({ ok: false, error: "This account is already archived or deleted." }, { status: 409 });
  }
  if (message.includes("profile not found")) {
    return NextResponse.json({ ok: false, error: "No active profile is connected to this login." }, { status: 404 });
  }
  return NextResponse.json({ ok: false, error: "Account deletion could not be prepared. Please try again." }, { status: 500 });
}

function authUserIsMissing(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string; message?: string };
  return candidate.status === 404 || candidate.code === "user_not_found" || /user not found/i.test(candidate.message ?? "");
}

function errorMessage(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "";
}

function snapshotStudentId(snapshot: DeletionSnapshot) {
  return typeof snapshot.student.id === "string" ? snapshot.student.id : null;
}

function restoredProfileMatches(row: DbRow | null, snapshot: DeletionSnapshot, authUserId: string) {
  return Boolean(
    row &&
    row.id === snapshot.student.id &&
    row.auth_user_id === authUserId &&
    row.account_deleted_at === null
  );
}

async function verifyRollback(admin: SupabaseAdmin, snapshot: DeletionSnapshot, authUserId: string) {
  const studentId = snapshotStudentId(snapshot);
  if (!studentId) return false;

  try {
    const [profileResult, pendingResult] = await Promise.all([
      admin.from("students").select("id,auth_user_id,account_deleted_at").eq("id", studentId).maybeSingle(),
      admin.from("account_deletion_operations").select("student_id").eq("student_id", studentId).maybeSingle()
    ]);
    return !profileResult.error &&
      !pendingResult.error &&
      !pendingResult.data &&
      restoredProfileMatches(profileResult.data as DbRow | null, snapshot, authUserId);
  } catch {
    return false;
  }
}

async function verifyCommittedDeletion(admin: SupabaseAdmin, snapshot: DeletionSnapshot) {
  const studentId = snapshotStudentId(snapshot);
  if (!studentId) return false;
  try {
    const { data, error } = await admin
      .from("students")
      .select("id,auth_user_id,email,is_active,account_deleted_at")
      .eq("id", studentId)
      .maybeSingle();
    return Boolean(
      !error &&
      data &&
      data.auth_user_id === null &&
      data.is_active === false &&
      data.email === snapshot.deletion_email &&
      data.account_deleted_at
    );
  } catch {
    return false;
  }
}

async function rollbackPreparedDeletion(admin: SupabaseAdmin, snapshot: DeletionSnapshot, authUserId: string) {
  const studentId = snapshotStudentId(snapshot);
  if (!studentId) return "failed" as const;

  let rollbackError: unknown = null;
  try {
    const { error } = await admin.rpc("rollback_self_account_deletion", {
      target_student_id: studentId,
      target_auth_user_id: authUserId,
      deletion_snapshot: snapshot
    });
    rollbackError = error;
  } catch (caught) {
    rollbackError = caught;
  }

  if (
    errorMessage(rollbackError).includes("Auth account no longer exists") &&
    await verifyCommittedDeletion(admin, snapshot)
  ) {
    return "auth_deleted" as const;
  }
  if (await verifyRollback(admin, snapshot, authUserId)) {
    return "restored" as const;
  }
  if (await verifyCommittedDeletion(admin, snapshot)) {
    return "auth_deleted" as const;
  }
  return "failed" as const;
}

async function finishDeletedSession(
  sessionClient: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>
) {
  invalidateAnalyticsCache();
  try {
    await sessionClient.auth.signOut({ scope: "local" });
  } catch {
    // The Auth user is already gone; a stale cookie will also be rejected by
    // middleware on the login navigation.
  }
  return NextResponse.json({ ok: true, message: "Your account has been deleted." });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Account deletion must be requested from this site." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "Send the confirmation as JSON." }, { status: 415 });
  }

  const sessionClient = await getSupabaseServerClient();
  if (!sessionClient) {
    return NextResponse.json({ ok: false, error: "Account deletion is unavailable because Supabase is not configured." }, { status: 503 });
  }
  const {
    data: { user },
    error: userError
  } = await sessionClient.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ ok: false, error: "Sign in again before deleting your account." }, { status: 401 });
  }
  const { data: claimsData, error: claimsError } = await sessionClient.auth.getClaims();
  if (claimsError || !hasRecentSessionAuthentication(claimsData?.claims, user.id)) {
    return NextResponse.json(
      { ok: false, error: "For security, sign out and sign back in before deleting your account." },
      { status: 401 }
    );
  }

  const body = (await request.json().catch(() => null)) as { confirmationEmail?: unknown } | null;
  const confirmationEmail = typeof body?.confirmationEmail === "string" ? body.confirmationEmail : "";
  if (!confirmationEmail || confirmationEmail.length > 254 || normalizedEmail(confirmationEmail) !== normalizedEmail(user.email)) {
    return NextResponse.json({ ok: false, error: "Type your account email exactly to confirm deletion." }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "Account deletion is unavailable because SUPABASE_SERVICE_ROLE_KEY is missing." },
      { status: 503 }
    );
  }

  let preparedData: unknown = null;
  let prepareError: unknown = null;
  try {
    const result = await admin.rpc("prepare_self_account_deletion", {
      target_auth_user_id: user.id,
      confirmation_email: confirmationEmail
    });
    preparedData = result.data;
    prepareError = result.error;
  } catch (caught) {
    prepareError = caught;
  }

  // Preparation writes a service-only durable snapshot without changing the
  // profile. If the RPC response is lost after commit, recover that snapshot
  // and safely resume instead of leaving an ambiguous operation behind.
  const snapshot = parseSnapshot(preparedData) ?? await loadPendingSnapshot(admin, user.id);
  if (!snapshot || snapshot.student.auth_user_id !== user.id || !snapshotStudentId(snapshot)) {
    if (prepareError) return preparationError(prepareError);
    return NextResponse.json(
      { ok: false, error: "Account deletion could not verify its recovery record. No profile changes were made." },
      { status: 500 }
    );
  }

  let deleteError: unknown = null;
  try {
    const result = await admin.auth.admin.deleteUser(user.id, false);
    deleteError = result.error;
  } catch (caught) {
    deleteError = caught;
  }
  if (!deleteError && await verifyCommittedDeletion(admin, snapshot)) {
    return finishDeletedSession(sessionClient);
  }

  // A transport error can arrive after Auth committed the delete. Check Auth
  // first; if that result is also inconclusive, the guarded rollback function
  // verifies auth.users inside the database before restoring any personal data.
  try {
    const authVerification = await admin.auth.admin.getUserById(user.id);
    if (
      !authVerification.data.user &&
      authUserIsMissing(authVerification.error) &&
      await verifyCommittedDeletion(admin, snapshot)
    ) {
      return finishDeletedSession(sessionClient);
    }
  } catch {
    // The guarded database rollback below is also an authoritative existence
    // check and is safe when the Auth status endpoint is unavailable.
  }

  const rollback = await rollbackPreparedDeletion(admin, snapshot, user.id);
  if (rollback === "auth_deleted") {
    return finishDeletedSession(sessionClient);
  }
  if (rollback === "restored") {
    return NextResponse.json(
      { ok: false, error: "Supabase Auth could not delete your login. No account-deletion changes were kept; please try again later." },
      { status: 502 }
    );
  }

  invalidateAnalyticsCache();
  return NextResponse.json(
    {
      ok: false,
      error: "Supabase Auth could not confirm deletion, and the profile rollback could not be verified. Contact an administrator before retrying."
    },
    { status: 500 }
  );
}
