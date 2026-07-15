"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UserRole } from "@/lib/types";

interface TourStep {
  title: string;
  body: string;
  target: string;
  href?: string;
}

function findVisibleTarget(target: string) {
  const matches = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
  const visible = matches.find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  });
  if (visible) return visible;
  if (target === "navigation" || target === "administration") {
    return document.querySelector<HTMLElement>("[data-tour=\"navigation-trigger\"]");
  }
  return undefined;
}

function findVisibleReturnTarget(key?: string | null) {
  const selectors = [
    key ? `[data-tour-return="${key}"]` : null,
    '[data-tour-return="profile-trigger"]',
    "#main-content",
  ].filter((selector): selector is string => Boolean(selector));

  for (const selector of selectors) {
    const match = Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return element.isConnected && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
    if (match) return match;
  }
  return null;
}

function clearTourHighlights() {
  document.querySelectorAll(".tour-highlight, .tour-highlight-layer").forEach((element) => {
    element.classList.remove("tour-highlight", "tour-highlight-layer");
  });
}

export function OnboardingTour({ userId, role }: { userId: string; role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const requestedReturnFocusRef = useRef<HTMLElement | null>(null);
  const returnFocusKeyRef = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const storageKey = `scioly-tour:v3:${userId}`;
  const activeKey = `scioly-tour-active:${userId}`;
  const indexKey = `scioly-tour-index:${userId}`;
  const returnKey = `scioly-tour-return:${userId}`;
  const steps = useMemo<TourStep[]>(() => [
    { title: "Everything starts in the navigation", body: "Team work, preparation, and role-specific administration are grouped so you always know where to go.", target: "navigation" },
    { title: "Find anything quickly", body: "Use workspace search for features, students, teams, events, resources, and admin tools. You can also press Command K or Control K.", target: "search", href: "/dashboard" },
    { title: "Log your practice", body: "Every member—including officers and admins—submits their own preparation here. You can see pending and reviewed entries on the same page.", target: "points-form", href: "/points" },
    { title: "Check team readiness", body: "Search the roster, filter by team, and open any student to see the evidence behind their readiness score.", target: "roster", href: "/dashboard" },
    { title: "Prepare by event", body: "Resources and practice are organized by event, with real search and clear coverage status.", target: "resources-directory", href: "/resources" },
    ...(role === "viewer" ? [] : [{ title: "Review team actions", body: "Officer and admin tools live in their own section. Admins can reverse supported changes from the audit log.", target: "administration", href: "/admin/approve" }])
  ], [role]);

  useEffect(() => {
    const start = (event?: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as { returnFocus?: unknown; returnFocusKey?: unknown } | undefined
        : undefined;
      const requestedTarget = detail?.returnFocus;
      const requestedKey = typeof detail?.returnFocusKey === "string" ? detail.returnFocusKey : null;
      requestedReturnFocusRef.current = requestedTarget instanceof HTMLElement ? requestedTarget : null;
      returnFocusKeyRef.current = requestedKey;
      sessionStorage.setItem(activeKey, "true");
      sessionStorage.setItem(indexKey, "0");
      if (requestedKey) sessionStorage.setItem(returnKey, requestedKey);
      else sessionStorage.removeItem(returnKey);
      setIndex(0);
      setOpen(true);
    };
    window.addEventListener("scioly:start-tour", start);
    const active = sessionStorage.getItem(activeKey) === "true";
    if (active) {
      returnFocusKeyRef.current = sessionStorage.getItem(returnKey);
      const savedIndex = Number(sessionStorage.getItem(indexKey) ?? 0);
      setIndex(Number.isFinite(savedIndex) ? Math.max(0, Math.min(steps.length - 1, savedIndex)) : 0);
      setOpen(true);
    }
    if (!active && pathname === "/dashboard" && localStorage.getItem(storageKey) !== "complete") {
      const timer = window.setTimeout(start, 700);
      return () => { window.clearTimeout(timer); window.removeEventListener("scioly:start-tour", start); };
    }
    return () => window.removeEventListener("scioly:start-tour", start);
  }, [activeKey, indexKey, pathname, returnKey, steps.length, storageKey]);

  useEffect(() => {
    clearTourHighlights();
    if (!open) return;
    const step = steps[index];
    sessionStorage.setItem(indexKey, String(index));
    if (step.href && pathname !== step.href) {
      window.dispatchEvent(new Event("scioly:navigation-start"));
      router.push(step.href);
      return;
    }
    const timer = window.setTimeout(() => {
      const element = findVisibleTarget(step.target);
      element?.classList.add("tour-highlight");
      element?.closest<HTMLElement>("[data-tour-layer]")?.classList.add("tour-highlight-layer");
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
      dialogRef.current?.focus({ preventScroll: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [index, indexKey, open, pathname, router, steps]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = requestedReturnFocusRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    requestedReturnFocusRef.current = null;
    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-background]"));
    const previousInert = backgroundElements.map((element) => element.inert);
    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.inert = true;
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element, elementIndex) => {
        element.inert = previousInert[elementIndex];
      });
      const prior = previousFocusRef.current;
      if (prior?.isConnected && prior !== document.body && prior !== document.documentElement) prior.focus({ preventScroll: true });
      else findVisibleReturnTarget(returnFocusKeyRef.current)?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function finish() {
    localStorage.setItem(storageKey, "complete");
    sessionStorage.removeItem(activeKey);
    sessionStorage.removeItem(indexKey);
    sessionStorage.removeItem(returnKey);
    clearTourHighlights();
    setOpen(false);
  }

  function next() {
    if (index >= steps.length - 1) finish();
    else setIndex((current) => current + 1);
  }

  if (!open) return null;
  const step = steps[index];

  return (
    <>
      <div className="app-overlay fixed inset-0 z-[60] h-full w-full" onClick={finish} aria-hidden="true" />
      <aside ref={dialogRef} tabIndex={-1} className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[70] max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-md border border-court-control bg-court-panel p-5 shadow-panel focus:outline-none sm:left-auto sm:w-[min(420px,calc(100vw-2rem))] lg:bottom-6 lg:right-6" role="dialog" aria-modal="true" aria-labelledby="website-tour-title" aria-describedby="website-tour-description">
      <div className="text-xs font-medium text-cyan-300" role="status" aria-live="polite">Website tour · {index + 1} of {steps.length}</div>
      <h2 id="website-tour-title" className="mt-2 text-xl font-semibold text-white">{step.title}</h2>
      <p id="website-tour-description" className="mt-2 text-sm leading-6 text-zinc-500">{step.body}</p>
      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" onClick={finish} className="min-h-11 px-2 text-sm font-medium text-zinc-500 hover:text-white">Skip tour</button>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={index === 0} className="min-h-11 rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 disabled:bg-court-elevated disabled:text-zinc-500 disabled:opacity-100">Back</button>
          <button type="button" onClick={next} className="min-h-11 rounded-md bg-white px-4 text-sm font-semibold text-black">{index === steps.length - 1 ? "Finish" : "Next"}</button>
        </div>
      </div>
      </aside>
    </>
  );
}
