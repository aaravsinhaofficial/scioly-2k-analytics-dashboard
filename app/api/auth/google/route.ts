import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/app-url";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";
import { LEGAL_ACCEPTANCE_COOKIE, LEGAL_VERSION } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      { ok: false, error: "Google sign-in requires Supabase configuration." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    next?: string;
    signup?: boolean;
    acceptedPolicies?: boolean;
    legalVersion?: string;
  };
  const acceptsCurrentPolicies = body.acceptedPolicies === true && body.legalVersion === LEGAL_VERSION;
  if (!acceptsCurrentPolicies) {
    return NextResponse.json(
      { ok: false, error: "Agree to the current Terms of Service and acknowledge the Privacy Policy." },
      { status: 400 }
    );
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Auth client unavailable." }, { status: 500 });
  }

  // OAuth's PKCE verifier is stored in a cookie on the host that starts the
  // flow. Keep the callback on that same host so custom domains and preview
  // deployments can exchange the returned code successfully.
  const origin = new URL(request.url).origin;
  const next = safeInternalPath(body.next);
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo
    }
  });

  if (error || !data.url) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Could not start Google sign-in." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, redirectTo: data.url });
  if (acceptsCurrentPolicies) {
    response.cookies.set(LEGAL_ACCEPTANCE_COOKIE, LEGAL_VERSION, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      path: "/",
      maxAge: 10 * 60
    });
  }
  return response;
}
