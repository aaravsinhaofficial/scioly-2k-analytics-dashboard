import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth";
import { POINT_EVIDENCE_BUCKET, storedPointEvidenceFromMetadata } from "@/lib/point-evidence";
import { getSupabaseAdmin } from "@/lib/supabase";
import { roleMeets } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> }
) {
  const currentUser = await getAuthenticatedStudent();
  if (!currentUser) {
    return NextResponse.json({ ok: false, error: "Sign in to view submission evidence." }, { status: 401 });
  }

  const { id, evidenceId } = await params;
  const pointId = Number(id);
  if (!Number.isInteger(pointId) || pointId <= 0) {
    return NextResponse.json({ ok: false, error: "Evidence not found." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Evidence storage is not configured." }, { status: 503 });
  }

  const { data: point, error } = await supabase
    .from("grind_points")
    .select("student_id,metadata")
    .eq("id", pointId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!point) return NextResponse.json({ ok: false, error: "Evidence not found." }, { status: 404 });

  const canView = String(point.student_id) === currentUser.id || roleMeets(currentUser.role, "officer");
  if (!canView) {
    return NextResponse.json({ ok: false, error: "Evidence not found." }, { status: 404 });
  }

  const evidence = storedPointEvidenceFromMetadata(point.metadata)
    .find((entry) => entry.kind === "file" && entry.id === evidenceId);
  if (!evidence || evidence.kind !== "file") {
    return NextResponse.json({ ok: false, error: "Evidence not found." }, { status: 404 });
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(POINT_EVIDENCE_BUCKET)
    .createSignedUrl(evidence.storagePath, 60, { download: evidence.name });
  if (signedUrlError || !data?.signedUrl) {
    return NextResponse.json({ ok: false, error: "This evidence file is temporarily unavailable." }, { status: 503 });
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: { "cache-control": "private, no-store" }
  });
}
