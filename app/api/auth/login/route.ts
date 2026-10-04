import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/app-url";
import { getAuthenticatedStudent, recordLegalAcceptance } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";
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
    acceptedPolicies?: boolean;
    legalVersion?: string;
  };
  const email = body.email?.trim().toLowerCase();

  if (!email || !body.password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }
  if (body.acceptedPolicies !== true || body.legalVersion !== LEGAL_VERSION) {
    return NextResponse.json(
      { ok: false, error: "Agree to the current Terms of Service and acknowledge the Privacy Policy." },
      { status: 400 }
    );
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
        error: "This account has been archived. Ask a team administrator to restore it."
      },
      { status: 403 }
    );
  }
  const acceptanceSaved = await recordLegalAcceptance(student.id, new Date().toISOString(), LEGAL_VERSION);
  if (!acceptanceSaved) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { ok: false, error: "Your policy acceptance could not be saved. Please try again." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Signed in.",
    redirectTo: safeInternalPath(body.next)
  });
}
