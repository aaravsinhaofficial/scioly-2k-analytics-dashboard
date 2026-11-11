import { NextResponse } from "next/server";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ ok: true, message: "Demo session cleared.", redirectTo: "/login" });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Could not sign out. Please try again." }, { status: 503 });
  }
  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ ok: false, error: "Could not sign out. Please try again." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, message: "Signed out.", redirectTo: "/login" });
}
