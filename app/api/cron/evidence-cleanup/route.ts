import { NextResponse } from "next/server";
import { POINT_EVIDENCE_BUCKET } from "@/lib/point-evidence";
import { getSupabaseAdmin, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface CleanupTicket {
  ticket_id: string;
  storage_path: string;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (hasSupabaseConfig() && !secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: true, message: "Demo evidence cleanup completed.", removed: 0 });
  }

  const staleBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.rpc("claim_stale_point_evidence_uploads", {
    p_before: staleBefore,
    p_limit: 200
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const tickets = (data ?? []) as CleanupTicket[];
  if (tickets.length === 0) {
    return NextResponse.json({ ok: true, message: "No stale evidence uploads found.", removed: 0 });
  }

  const ticketIds = tickets.map((ticket) => ticket.ticket_id);
  const { error: removeError } = await supabase.storage
    .from(POINT_EVIDENCE_BUCKET)
    .remove(tickets.map((ticket) => ticket.storage_path));
  if (removeError) {
    await supabase
      .from("point_evidence_upload_tickets")
      .update({ status: "cleanup_pending", claimed_at: null })
      .in("id", ticketIds)
      .eq("status", "cleanup_pending");
    return NextResponse.json({ ok: false, error: "Stale uploads could not be removed." }, { status: 500 });
  }

  const { error: finalizeError } = await supabase
    .from("point_evidence_upload_tickets")
    .update({
      status: "deleted",
      claim_id: null,
      claimed_at: null,
      deleted_at: new Date().toISOString()
    })
    .in("id", ticketIds)
    .eq("status", "cleanup_pending");
  if (finalizeError) {
    return NextResponse.json(
      { ok: false, error: "Uploads were removed, but their cleanup records could not be finalized." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "Stale evidence uploads removed.", removed: tickets.length });
}

export async function GET(request: Request) {
  return POST(request);
}
