import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const allowedOtpTypes = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/dashboard";

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  if (tokenHash && type && allowedOtpTypes.has(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.url));
}
