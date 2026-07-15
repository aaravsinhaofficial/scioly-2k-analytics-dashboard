import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/app-url";
import { getAuthenticatedStudent } from "@/lib/auth";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const allowedOtpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeInternalPath(url.searchParams.get("next"));

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const authClient = supabase;

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  async function redirectAfterSuccessfulAuth() {
    const student = await getAuthenticatedStudent();
    if (student) {
      return NextResponse.redirect(new URL(next, request.url));
    }

    await authClient.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=account_unavailable", request.url));
  }

  if (code) {
    const { error } = await authClient.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectAfterSuccessfulAuth();
    }
  }

  if (tokenHash && type && allowedOtpTypes.has(type)) {
    const { error } = await authClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });
    if (!error) {
      return redirectAfterSuccessfulAuth();
    }
  }

  const failurePath = next.startsWith("/reset-password")
    ? "/reset-password?error=invalid_reset_link"
    : "/login?error=auth_callback_failed";
  return NextResponse.redirect(new URL(failurePath, request.url));
}
