import { NextResponse } from "next/server";
import { validatePassword } from "@/lib/password";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured for this deployment." },
      { status: 503 }
    );
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password ?? "";
  const validation = validatePassword(password);
  if (!validation.valid) {
    return NextResponse.json({ ok: false, error: validation.errors.join(" ") }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "Password updated.",
    redirectTo: "/dashboard"
  });
}
