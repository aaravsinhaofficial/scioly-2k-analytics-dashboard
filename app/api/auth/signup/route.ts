import { NextResponse } from "next/server";
import { ensureStudentProfile } from "@/lib/auth";
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

  const body = (await request.json()) as {
    name?: string;
    grade?: number;
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  const grade = Number(body.grade);
  const password = body.password ?? "";
  const passwordValidation = validatePassword(password);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
  }

  if (!Number.isInteger(grade) || grade < 9 || grade > 12) {
    return NextResponse.json({ ok: false, error: "Grade must be 9, 10, 11, or 12." }, { status: 400 });
  }

  if (!passwordValidation.valid) {
    return NextResponse.json({ ok: false, error: passwordValidation.errors.join(" ") }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        grade
      },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`
    }
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  if (data.user?.id) {
    await ensureStudentProfile({
      authUserId: data.user.id,
      email,
      name,
      grade
    });
  }

  return NextResponse.json({
    ok: true,
    message: data.session
      ? "Account created. You are signed in."
      : "Account created. Check your email to verify before signing in.",
    redirectTo: data.session ? "/dashboard" : undefined
  });
}
