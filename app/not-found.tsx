import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-court-black px-4 py-12 text-center">
      <section className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.05] p-7 shadow-2xl sm:p-10" aria-labelledby="not-found-title">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Page not found</p>
        <h1 id="not-found-title" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          This page is not available.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/70 sm:text-base">
          The link may be outdated, or you may not have access to this part of the team workspace.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
