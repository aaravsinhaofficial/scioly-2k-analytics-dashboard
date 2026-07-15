"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    titleRef.current?.focus();
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-court-black px-4 py-12 text-center">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 shadow-2xl sm:p-10" aria-labelledby="error-title">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Something went wrong</p>
        <h1 ref={titleRef} id="error-title" tabIndex={-1} className="mt-3 text-3xl font-semibold tracking-tight text-white outline-none sm:text-4xl">
          We could not load this page.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/70 sm:text-base">
          Try again now. If the problem continues, return to the dashboard and choose another section.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Return to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
