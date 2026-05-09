import { NextResponse } from "next/server";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, message: "Demo session cleared.", redirectTo: "/login" });
  }

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  return NextResponse.json({ ok: true, message: "Signed out.", redirectTo: "/login" });
}
