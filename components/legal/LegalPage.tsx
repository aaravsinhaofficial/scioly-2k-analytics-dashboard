import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <main className="min-h-screen bg-court-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="SciOly Tracker home">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-black shadow-sm">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="truncate text-base font-semibold text-white">SciOly Tracker</span>
          </Link>
          <ThemeToggle compact />
        </header>

        <article className="mt-8 rounded-md border border-court-line bg-court-panel p-5 shadow-panel sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Team policies</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-zinc-500">Effective {LEGAL_EFFECTIVE_DATE}</p>
          <p className="mt-6 text-base leading-7 text-zinc-600">{intro}</p>

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-7 text-zinc-600">{paragraph}</p>
                ))}
                {section.items ? (
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-600">
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-6 text-xs text-zinc-500">
          <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-white">Terms of Service</Link>
          <Link href="/login" className="hover:text-white">Sign in</Link>
        </footer>
      </div>
    </main>
  );
}
