"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Chrome, Loader2, LockKeyhole, Mail, UserPlus } from "lucide-react";
import { validatePassword } from "@/lib/password";

type AuthMode = "login" | "signup" | "reset-request" | "reset-update";

interface AuthCardProps {
  mode: AuthMode;
}

const modeCopy: Record<AuthMode, { title: string; eyebrow: string; action: string; endpoint: string }> = {
  login: {
    title: "Sign In",
    eyebrow: "SciOly 2K Account",
    action: "Sign In",
    endpoint: "/api/auth/login"
  },
  signup: {
    title: "Create Account",
    eyebrow: "Viewer Access",
    action: "Create Account",
    endpoint: "/api/auth/signup"
  },
  "reset-request": {
    title: "Reset Password",
    eyebrow: "Account Recovery",
    action: "Send Reset Link",
    endpoint: "/api/auth/password-reset"
  },
  "reset-update": {
    title: "Set New Password",
    eyebrow: "Account Recovery",
    action: "Update Password",
    endpoint: "/api/auth/update-password"
  }
};

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = modeCopy[mode];
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("9");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const needsEmail = mode !== "reset-update";
  const needsPassword = mode !== "reset-request";
  const isSignup = mode === "signup";

  function submit() {
    setMessage(null);
    setError(null);

    if (needsPassword) {
      const validation = validatePassword(password);
      if (!validation.valid) {
        setError(validation.errors.join(" "));
        return;
      }
    }

    startTransition(async () => {
      try {
        const response = await fetch(copy.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            grade: Number(grade),
            email,
            password,
            next: searchParams.get("next") ?? "/dashboard"
          })
        });

        if (!response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("Auth API unavailable");
        }

        const payload = (await response.json()) as {
          ok: boolean;
          message?: string;
          error?: string;
          redirectTo?: string;
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error ?? "Auth request failed.");
        }

        setMessage(payload.message ?? "Success.");
        if (payload.redirectTo) {
          router.push(payload.redirectTo);
          router.refresh();
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Auth request failed.";
        setError(
          message === "Auth API unavailable"
            ? "Accounts require the Vercel/Supabase deployment. GitHub Pages is a read-only demo."
            : message
        );
      }
    });
  }

  function continueWithGoogle() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next: searchParams.get("next") ?? "/dashboard" })
        });
        const payload = (await response.json()) as { ok: boolean; redirectTo?: string; error?: string };
        if (!response.ok || !payload.ok || !payload.redirectTo) {
          throw new Error(payload.error ?? "Could not start Google sign-in.");
        }
        window.location.href = payload.redirectTo;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Could not start Google sign-in.";
        setError(
          message.includes("Supabase")
            ? "Google accounts require the Vercel/Supabase deployment. GitHub Pages is a read-only demo."
            : message
        );
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
      <div className="grid w-full overflow-hidden rounded-md border border-court-line bg-court-panel shadow-panel lg:grid-cols-[1fr_440px]">
        <section className="flex min-h-[520px] flex-col justify-between border-b border-court-line p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-opal">
              {isSignup ? <UserPlus className="h-6 w-6" aria-hidden="true" /> : <LockKeyhole className="h-6 w-6" aria-hidden="true" />}
            </div>
            <div className="mt-8 text-xs font-black uppercase text-cyan-300">{copy.eyebrow}</div>
            <h1 className="mt-2 text-5xl font-black italic uppercase leading-none text-white md:text-6xl">
              {copy.title}
            </h1>
            <p className="mt-4 max-w-2xl text-zinc-400">
              Accounts use Supabase Auth. New signups start as Viewers with a 60 OVR baseline, then officers or admins
              can approve work and adjust roles from the database.
            </p>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3">
            <div className="rounded-md border border-court-line bg-court-elevated p-3">
              <div className="font-black uppercase text-zinc-500">Default</div>
              <div className="mt-1 text-white">Viewer</div>
            </div>
            <div className="rounded-md border border-court-line bg-court-elevated p-3">
              <div className="font-black uppercase text-zinc-500">Baseline</div>
              <div className="mt-1 text-white">60 OVR</div>
            </div>
            <div className="rounded-md border border-court-line bg-court-elevated p-3">
              <div className="font-black uppercase text-zinc-500">School</div>
              <div className="mt-1 text-white">Tompkins</div>
            </div>
          </div>
        </section>

        <section className="p-5 md:p-6">
          <div className="space-y-4">
            {isSignup ? (
              <>
                <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
                  Name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
                  Grade
                  <select
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                  </select>
                </label>
              </>
            ) : null}

            {needsEmail ? (
              <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
                Email
                <span className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="h-11 w-full rounded-md border border-court-line bg-court-elevated px-9 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
                  />
                </span>
              </label>
            ) : null}

            {needsPassword ? (
              <label className="grid gap-2 text-xs font-black uppercase text-zinc-500">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="h-11 rounded-md border border-court-line bg-court-elevated px-3 text-sm font-bold normal-case text-white outline-none transition focus:border-cyan-400"
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-black uppercase text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {copy.action}
            </button>

            {(mode === "login" || mode === "signup") ? (
              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={isPending}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-black uppercase text-zinc-200 transition hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Chrome className="h-4 w-4" aria-hidden="true" />}
                Continue With Google
              </button>
            ) : null}

            {message ? <div className="rounded-md border border-emerald-300/40 bg-emerald-300/10 p-3 text-sm text-emerald-100">{message}</div> : null}
            {error ? <div className="rounded-md border border-red-300/40 bg-red-300/10 p-3 text-sm text-red-100">{error}</div> : null}
          </div>

          <div className="mt-6 space-y-2 text-sm text-zinc-400">
            {mode === "login" ? (
              <>
                <div>
                  No account yet?{" "}
                  <Link href="/signup" className="font-black text-cyan-300 hover:text-white">
                    Create one
                  </Link>
                </div>
                <Link href="/reset-password" className="inline-block font-black text-zinc-300 hover:text-white">
                  Forgot password?
                </Link>
              </>
            ) : null}
            {mode === "signup" ? (
              <div>
                Already have an account?{" "}
                <Link href="/login" className="font-black text-cyan-300 hover:text-white">
                  Sign in
                </Link>
              </div>
            ) : null}
            {mode !== "login" && mode !== "signup" ? (
              <Link href="/login" className="inline-block font-black text-cyan-300 hover:text-white">
                Back to sign in
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
