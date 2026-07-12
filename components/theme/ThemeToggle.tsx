"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    setMounted(true);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("scioly-theme", next);
    setTheme(next);
  }

  const isDark = mounted && theme === "dark";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-3 rounded-md text-sm text-zinc-600 transition-colors hover:bg-court-elevated hover:text-white",
        compact ? "w-11" : "w-full px-3"
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {!compact ? <span className="flex-1 text-left">{isDark ? "Light mode" : "Dark mode"}</span> : null}
    </button>
  );
}
