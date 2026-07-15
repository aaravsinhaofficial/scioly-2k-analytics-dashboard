import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/app-url";
import { getAuthenticatedStudent } from "@/lib/auth";
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
    email?: string;
    password?: string;
    next?: string;
  };
  const email = body.email?.trim().toLowerCase();

  if (!email || !body.password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: body.password
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  const student = await getAuthenticatedStudent();
  if (!student) {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        ok: false,
        error: "This account is not active for this team. Ask a team administrator to add or restore it."
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Signed in.",
    redirectTo: safeInternalPath(body.next)
  });
}
