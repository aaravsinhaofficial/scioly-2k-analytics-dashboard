"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpen, ClipboardCheck, FileUp, History, LayoutDashboard, LogOut, Shield, Target, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { Student } from "@/lib/types";
import { cn, roleMeets } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";

interface AppShellProps {
  currentUser: Student;
  schoolName?: string;
  children: ReactNode;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, role: "viewer" as const },
  { href: "/teams", label: "Teams", icon: Users, role: "viewer" as const },
  { href: "/resources", label: "Resources", icon: BookOpen, role: "viewer" as const },
  { href: "/practice", label: "Practice", icon: Target, role: "viewer" as const },
  { href: "/admin/approve", label: "Approve", icon: ClipboardCheck, role: "officer" as const },
  { href: "/admin/upload", label: "Upload", icon: FileUp, role: "officer" as const },
  { href: "/admin/manage", label: "Manage", icon: Shield, role: "admin" as const },
  { href: "/admin/audit", label: "Audit", icon: History, role: "admin" as const }
];

export function AppShell({ currentUser, schoolName = "Obra D Tompkins High School", children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = navItems.filter((item) => roleMeets(currentUser.role, item.role));

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-court-line bg-court-black/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <Link href="/dashboard" className="group flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-opal">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-xl font-black italic uppercase leading-none text-white">SciOly 2K</div>
              <div className="mt-1 text-xs font-bold uppercase text-zinc-500">{schoolName}</div>
            </div>
          </Link>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <nav className="flex gap-1 overflow-x-auto rounded-md border border-court-line bg-court-panel p-1">
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded px-3 text-xs font-black uppercase text-zinc-400 transition hover:bg-white/5 hover:text-white",
                      active && "bg-white text-black hover:bg-white hover:text-black"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <Link
              href={`/profile/${currentUser.id}`}
              className="flex items-center gap-3 rounded-md border border-court-line bg-court-panel px-3 py-2 transition hover:border-cyan-400/60"
            >
              <Avatar name={currentUser.name} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-white">{currentUser.name}</div>
                <div className="text-[11px] font-black uppercase text-cyan-300">{currentUser.role}</div>
              </div>
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="grid h-11 w-11 place-items-center rounded-md border border-court-line bg-court-panel text-zinc-300 transition hover:border-red-400 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</main>
    </div>
  );
}
