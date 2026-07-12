"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/lib/types";

interface TourStep {
  title: string;
  body: string;
  target: string;
  href?: string;
}

export function OnboardingTour({ userId, role }: { userId: string; role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const storageKey = `scioly-tour:v2:${userId}`;
  const activeKey = `scioly-tour-active:${userId}`;
  const indexKey = `scioly-tour-index:${userId}`;
  const steps = useMemo<TourStep[]>(() => [
    { title: "Everything starts in the navigation", body: "Team work, preparation, and role-specific administration are grouped so you always know where to go.", target: "navigation" },
    { title: "Log your practice", body: "Every member—including officers and admins—submits their own preparation here. You can see pending and reviewed entries on the same page.", target: "points-form", href: "/points" },
    { title: "Check team readiness", body: "Search the roster, filter by team, and open any student to see the evidence behind their readiness score.", target: "roster", href: "/dashboard" },
    { title: "Prepare by event", body: "Resources and practice are organized by event, with real search and clear coverage status.", target: "resources", href: "/resources" },
    ...(role === "viewer" ? [] : [{ title: "Review team actions", body: "Officer and admin tools live in their own section. Admins can reverse supported changes from the audit log.", target: "administration", href: "/admin/approve" }])
  ], [role]);

  useEffect(() => {
    const start = () => { sessionStorage.setItem(activeKey, "true"); sessionStorage.setItem(indexKey, "0"); setIndex(0); setOpen(true); };
    window.addEventListener("scioly:start-tour", start);
    const active = sessionStorage.getItem(activeKey) === "true";
    if (active) {
      setIndex(Math.min(steps.length - 1, Number(sessionStorage.getItem(indexKey) ?? 0)));
      setOpen(true);
    }
    if (!active && pathname === "/dashboard" && localStorage.getItem(storageKey) !== "complete") {
      const timer = window.setTimeout(start, 700);
      return () => { window.clearTimeout(timer); window.removeEventListener("scioly:start-tour", start); };
    }
    return () => window.removeEventListener("scioly:start-tour", start);
  }, [activeKey, indexKey, pathname, steps.length, storageKey]);

  useEffect(() => {
    document.querySelectorAll(".tour-highlight").forEach((element) => element.classList.remove("tour-highlight"));
    if (!open) return;
    const step = steps[index];
    sessionStorage.setItem(indexKey, String(index));
    if (step.href && pathname !== step.href) {
      router.push(step.href);
      return;
    }
    const timer = window.setTimeout(() => {
      const element = document.querySelector(`[data-tour="${step.target}"]`);
      element?.classList.add("tour-highlight");
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [index, indexKey, open, pathname, router, steps]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function finish() {
    localStorage.setItem(storageKey, "complete");
    sessionStorage.removeItem(activeKey);
    sessionStorage.removeItem(indexKey);
    document.querySelectorAll(".tour-highlight").forEach((element) => element.classList.remove("tour-highlight"));
    setOpen(false);
  }

  function next() {
    if (index >= steps.length - 1) finish();
    else setIndex((current) => current + 1);
  }

  if (!open) return null;
  const step = steps[index];

  return (
    <aside className="fixed bottom-24 right-4 z-[70] w-[min(420px,calc(100vw-2rem))] rounded-md border border-court-line bg-court-panel p-5 shadow-panel lg:bottom-6 lg:right-6" role="dialog" aria-label="Website tour" aria-live="polite">
      <div className="text-xs font-medium text-cyan-300">Website tour · {index + 1} of {steps.length}</div>
      <h2 className="mt-2 text-xl font-semibold text-white">{step.title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{step.body}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={finish} className="min-h-11 px-2 text-sm font-medium text-zinc-500 hover:text-white">Skip tour</button>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0} className="min-h-11 rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 disabled:opacity-40">Back</button>
          <button type="button" onClick={next} className="min-h-11 rounded-md bg-white px-4 text-sm font-semibold text-black">{index === steps.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>
    </aside>
  );
}
