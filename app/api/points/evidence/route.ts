import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import {
  cleanEvidenceFileName,
  evidenceStorageExtension,
  normalizeEvidenceMimeType,
  MAX_POINT_EVIDENCE_FILES,
  MAX_POINT_EVIDENCE_FILE_BYTES,
  MAX_POINT_EVIDENCE_TOTAL_BYTES,
  POINT_EVIDENCE_BUCKET,
  storedPointEvidenceFromMetadata
} from "@/lib/point-evidence";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface RequestedFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
}

async function requireEvidenceStorage() {
  const currentUser = await getAuthenticatedStudent();
  if (!currentUser) {
    return { error: NextResponse.json({ ok: false, error: "Sign in before uploading evidence." }, { status: 401 }) };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: NextResponse.json({ ok: false, error: "Evidence storage is not configured for this deployment." }, { status: 503 }) };
  }

  return { currentUser, supabase };
}

function validateRequestedFiles(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_POINT_EVIDENCE_FILES) {
    return { error: `Choose between 1 and ${MAX_POINT_EVIDENCE_FILES} evidence files.` };
  }

  const files: RequestedFile[] = [];
  let totalBytes = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { error: "One of the selected evidence files is invalid." };
    }
    const row = entry as Record<string, unknown>;
    if (typeof row.name !== "string" || typeof row.mimeType !== "string" || typeof row.sizeBytes !== "number") {
      return { error: "One of the selected evidence files is invalid." };
    }
    const name = cleanEvidenceFileName(row.name);
    const mimeType = normalizeEvidenceMimeType(name, row.mimeType);
    const sizeBytes = row.sizeBytes;
    if (!mimeType) {
      return { error: `${name} is not a supported image, audio, video, or PDF file.` };
    }
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_POINT_EVIDENCE_FILE_BYTES) {
      return { error: `${name} must be 15 MB or smaller.` };
    }
    totalBytes += sizeBytes;
    files.push({ name, mimeType, sizeBytes });
  }

  if (totalBytes > MAX_POINT_EVIDENCE_TOTAL_BYTES) {
    return { error: "Evidence files can total no more than 50 MB per submission." };
  }
  return { files };
}

export async function POST(request: Request) {
  const auth = await requireEvidenceStorage();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { files?: unknown } | null;
  const validated = validateRequestedFiles(body?.files);
  if ("error" in validated) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const batchId = crypto.randomUUID();
  const uploadDescriptors = validated.files.map((file) => {
    const id = crypto.randomUUID();
    const storagePath = `${auth.currentUser.id}/${batchId}/${id}${evidenceStorageExtension(file.mimeType)}`;
    return { id, ...file, storagePath };
  });

  const { error: reservationError } = await auth.supabase.rpc("reserve_point_evidence_uploads", {
    p_student_id: auth.currentUser.id,
    p_batch_id: batchId,
    p_uploads: uploadDescriptors
  });
  if (reservationError) {
    const limitReached = reservationError.message.includes("POINT_EVIDENCE_UPLOAD_LIMIT");
    return NextResponse.json(
      {
        ok: false,
        error: limitReached
          ? "Evidence upload limit reached. You can request up to 50 files or 500 MB of upload tickets in 24 hours."
          : "Evidence storage is unavailable. Ask an administrator to apply the latest Supabase schema."
      },
      { status: limitReached ? 429 : 503 }
    );
  }

  const signedUploads = await Promise.all(uploadDescriptors.map(async (upload) => {
    const { data, error } = await auth.supabase.storage
      .from(POINT_EVIDENCE_BUCKET)
      .createSignedUploadUrl(upload.storagePath, { upsert: false });
    return error || !data?.token ? null : { ...upload, token: data.token };
  }));

  if (signedUploads.some((upload) => !upload)) {
    await auth.supabase
      .from("point_evidence_upload_tickets")
      .update({ status: "expired", deleted_at: new Date().toISOString() })
      .eq("student_id", auth.currentUser.id)
      .eq("batch_id", batchId)
      .eq("status", "reserved");
    return NextResponse.json(
      { ok: false, error: "Evidence storage is unavailable. Please try again." },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { ok: true, bucket: POINT_EVIDENCE_BUCKET, uploads: signedUploads },
    { headers: { "cache-control": "private, no-store" } }
  );
}

export async function DELETE(request: Request) {
  const auth = await requireEvidenceStorage();
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = Array.isArray(body?.paths)
    ? Array.from(new Set(body.paths.filter((path): path is string => typeof path === "string" && path.startsWith(`${auth.currentUser.id}/`)))).slice(0, MAX_POINT_EVIDENCE_FILES)
    : [];
  if (paths.length === 0) {
    return NextResponse.json({ ok: false, error: "No evidence uploads were provided." }, { status: 400 });
  }

  const deleteClaimId = crypto.randomUUID();
  const { data: claimedTickets, error: claimError } = await auth.supabase
    .from("point_evidence_upload_tickets")
    .update({ status: "cleanup_pending", claim_id: deleteClaimId, claimed_at: new Date().toISOString() })
    .eq("student_id", auth.currentUser.id)
    .in("storage_path", paths)
    .in("status", ["reserved", "expired"])
    .select("storage_path");
  if (claimError) {
    return NextResponse.json({ ok: false, error: "Evidence cleanup is unavailable." }, { status: 503 });
  }
  if ((claimedTickets?.length ?? 0) !== paths.length) {
    await auth.supabase
      .from("point_evidence_upload_tickets")
      .update({ status: "reserved", claim_id: null, claimed_at: null })
      .eq("student_id", auth.currentUser.id)
      .eq("claim_id", deleteClaimId);
    return NextResponse.json(
      { ok: false, error: "One or more uploads are already attached, in use, or expired." },
      { status: 409 }
    );
  }

  const { data: pointRows, error: pointError } = await auth.supabase
    .from("grind_points")
    .select("metadata")
    .eq("student_id", auth.currentUser.id);
  if (pointError) {
    await auth.supabase
      .from("point_evidence_upload_tickets")
      .update({ status: "reserved", claim_id: null, claimed_at: null })
      .eq("student_id", auth.currentUser.id)
      .eq("claim_id", deleteClaimId);
    return NextResponse.json({ ok: false, error: pointError.message }, { status: 500 });
  }
  const attachedPaths = new Set(
    (pointRows ?? []).flatMap((row) => storedPointEvidenceFromMetadata(row.metadata))
      .flatMap((entry) => entry.kind === "file" ? [entry.storagePath] : [])
  );
  if (paths.some((path) => attachedPaths.has(path))) {
    await auth.supabase
      .from("point_evidence_upload_tickets")
      .update({ status: "attached", claim_id: null, claimed_at: null, attached_at: new Date().toISOString() })
      .eq("student_id", auth.currentUser.id)
      .eq("claim_id", deleteClaimId);
    return NextResponse.json(
      { ok: false, error: "Evidence that is already attached to a point submission cannot be removed as a staged upload." },
      { status: 409 }
    );
  }

  const { error } = await auth.supabase.storage.from(POINT_EVIDENCE_BUCKET).remove(paths);
  if (error) {
    await auth.supabase
      .from("point_evidence_upload_tickets")
      .update({ status: "cleanup_pending", claim_id: null, claimed_at: null })
      .eq("student_id", auth.currentUser.id)
      .eq("claim_id", deleteClaimId);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const { error: ticketError } = await auth.supabase
    .from("point_evidence_upload_tickets")
    .update({
      status: "deleted",
      claim_id: null,
      claimed_at: null,
      deleted_at: new Date().toISOString()
    })
    .eq("student_id", auth.currentUser.id)
    .eq("claim_id", deleteClaimId);
  if (ticketError) {
    return NextResponse.json({ ok: false, error: "The uploads were removed, but their cleanup records could not be updated." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
