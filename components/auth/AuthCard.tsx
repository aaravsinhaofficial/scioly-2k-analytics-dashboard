"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowRight, Chrome, GraduationCap, Loader2, Mail } from "lucide-react";
import { validatePassword } from "@/lib/password";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type AuthMode = "login" | "signup" | "reset-request" | "reset-update";

interface AuthCardProps {
  mode: AuthMode;
  publicSignupEnabled?: boolean;
}

const modeCopy: Record<AuthMode, { title: string; description: string; action: string; endpoint: string }> = {
  login: {
    title: "Welcome back",
    description: "Sign in to view your team, rankings, and practice activity.",
    action: "Sign in",
    endpoint: "/api/auth/login",
  },
  signup: {
    title: "Create your account",
    description: "Join your Science Olympiad team workspace.",
    action: "Create account",
    endpoint: "/api/auth/signup",
  },
  "reset-request": {
    title: "Reset your password",
    description: "Enter your email and we’ll send you a reset link.",
    action: "Send reset link",
    endpoint: "/api/auth/password-reset",
  },
  "reset-update": {
    title: "Choose a new password",
    description: "Use a strong password you don’t use anywhere else.",
    action: "Update password",
    endpoint: "/api/auth/update-password",
  },
};

export function AuthCard({ mode, publicSignupEnabled = true }: AuthCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copy = modeCopy[mode];
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("9");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(() =>
    mode === "login" && searchParams.get("account_deleted") === "1"
      ? "Your account has been permanently deleted."
      : null
  );
  const [error, setError] = useState<string | null>(() =>
    searchParams.get("error") === "invalid_reset_link"
      ? "This password reset link is invalid or expired. Request a new link below."
      : searchParams.get("error") === "auth_callback_failed"
        ? "Sign-in could not be completed. Please try again or contact your team administrator."
        : searchParams.get("error") === "account_archived"
          ? "This account has been archived. Ask a team administrator to restore it before signing in."
          : null
  );
  const [isPending, startTransition] = useTransition();
  const needsEmail = mode !== "reset-update";
  const needsPassword = mode !== "reset-request";
  const isSignup = mode === "signup";

  function submit(event?: FormEvent) {
    event?.preventDefault();
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
            next: searchParams.get("next") ?? "/dashboard",
          }),
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

        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Auth request failed.");
        setMessage(payload.message ?? "Success.");
        if (payload.redirectTo) {
          router.push(payload.redirectTo);
          router.refresh();
        }
      } catch (caught) {
        const caughtMessage = caught instanceof Error ? caught.message : "Auth request failed.";
        setError(
          caughtMessage === "Auth API unavailable"
            ? "Sign-in is temporarily unavailable. Please try again or contact your team administrator."
            : caughtMessage
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
          body: JSON.stringify({ next: searchParams.get("next") ?? "/dashboard" }),
        });
        const payload = (await response.json()) as { ok: boolean; redirectTo?: string; error?: string };
        if (!response.ok || !payload.ok || !payload.redirectTo) {
          throw new Error(payload.error ?? "Could not start Google sign-in.");
        }
        window.location.href = payload.redirectTo;
      } catch (caught) {
        const caughtMessage = caught instanceof Error ? caught.message : "Could not start Google sign-in.";
        setError(
          caughtMessage.includes("Supabase")
            ? "Google sign-in isn’t available right now. Try email and password instead."
            : caughtMessage
        );
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-court-black px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle compact /></div>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-7 flex items-center justify-center gap-3" aria-label="SciOly Tracker home">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-white text-black shadow-sm">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-white">SciOly Tracker</span>
        </Link>

        <section className="rounded-md border border-court-line bg-court-panel p-6 shadow-panel sm:p-8">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{copy.title}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{copy.description}</p>
          </header>

          <form className="mt-7 space-y-4" onSubmit={submit}>
            {isSignup ? (
              <div className="grid gap-4 sm:grid-cols-[1fr_112px]">
                <label className="grid gap-2 text-sm font-medium text-zinc-600">
                  Full name
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-zinc-600">
                  Grade
                  <select
                    value={grade}
                    onChange={(event) => setGrade(event.target.value)}
                    className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  >
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="11">11</option>
                    <option value="12">12</option>
                  </select>
                </label>
              </div>
            ) : null}

            {needsEmail ? (
              <label className="grid gap-2 text-sm font-medium text-zinc-600">
                Email address
                <span className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className="h-11 w-full rounded-md border border-court-line bg-court-panel pl-9 pr-3 text-sm text-white outline-none transition focus:border-cyan-400"
                  />
                </span>
              </label>
            ) : null}

            {needsPassword ? (
              <label className="grid gap-2 text-sm font-medium text-zinc-600">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  className="h-11 rounded-md border border-court-line bg-court-panel px-3 text-sm text-white outline-none transition focus:border-cyan-400"
                />
              </label>
            ) : null}

            {mode === "login" ? (
              <div className="text-right">
                <Link href="/reset-password" className="text-sm font-medium text-cyan-300 hover:text-white">Forgot password?</Link>
              </div>
            ) : null}

            {message ? <div className="rounded-md bg-emerald-300/10 p-3 text-sm text-emerald-200" role="status">{message}</div> : null}
            {error ? <div className="rounded-md bg-red-300/10 p-3 text-sm text-red-200" role="alert">{error}</div> : null}

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:border disabled:border-court-line disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              {copy.action}
            </button>
          </form>

          {mode === "login" || mode === "signup" ? (
            <div className="my-5 flex items-center gap-3 text-xs text-zinc-500 before:h-px before:flex-1 before:bg-court-line after:h-px after:flex-1 after:bg-court-line">
              or
            </div>
          ) : null}

          {mode === "login" || mode === "signup" ? (
            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={isPending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-semibold text-zinc-700 transition hover:border-cyan-400 hover:text-white disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100"
            >
              <Chrome className="h-4 w-4" aria-hidden="true" />
              Continue with Google
            </button>
          ) : null}

          <div className="mt-6 text-center text-sm text-zinc-500">
            {mode === "login" ? (
              publicSignupEnabled
                ? <>New to the team? <Link href="/signup" className="font-medium text-cyan-300 hover:text-white">Create an account</Link></>
                : <>Team accounts are invite-only. Ask an administrator for access.</>
            ) : null}
            {mode === "signup" ? <>Already have an account? <Link href="/login" className="font-medium text-cyan-300 hover:text-white">Sign in</Link></> : null}
            {mode !== "login" && mode !== "signup" ? <Link href="/login" className="font-medium text-cyan-300 hover:text-white">Back to sign in</Link> : null}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-zinc-500">For Obra D. Tompkins Science Olympiad</p>
      </div>
    </main>
  );
}
