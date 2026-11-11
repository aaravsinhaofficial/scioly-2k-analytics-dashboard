"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

export function LiveRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const versionRef = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function check() {
      if (cancelled || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch("/api/version", { cache: "no-store", headers: { accept: "application/json" } });
        if (!response.ok) return;
        const payload = await response.json() as { version?: string };
        if (cancelled || !payload.version) return;
        if (versionRef.current && versionRef.current !== payload.version) {
          versionRef.current = payload.version;
          window.dispatchEvent(new Event("scioly:data-updated"));
          startTransition(() => router.refresh());
        } else {
          versionRef.current = payload.version;
        }
      } catch {
        // A temporary outage is retried by the next poll, without interrupting the current task.
      } finally {
        inFlight = false;
      }
    }

    void check();
    const interval = window.setInterval(check, 4000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname, router]);

  return null;
}
