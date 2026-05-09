import { NextResponse } from "next/server";
import { mockStudents } from "@/lib/seed";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-static";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  if (supabase) {
    const { error } = await supabase.rpc("create_weekly_ovr_snapshots");
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    message: supabase ? "Weekly snapshots created." : "Demo snapshot job completed.",
    studentsProcessed: mockStudents.length
  });
}

export async function GET(request: Request) {
  return POST(request);
}
