import { NextResponse } from "next/server";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured for this deployment." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Password reset link sent. Check your email." });
}
