"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileUp,
  History,
  LayoutDashboard,
  LogOut,
  Shield,
  Target,
  Users,
} from "lucide-react";
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
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    role: "viewer" as const,
  },
  { href: "/teams", label: "Teams", icon: Users, role: "viewer" as const },
  {
    href: "/resources",
    label: "Resources",
    icon: BookOpen,
    role: "viewer" as const,
  },
  {
    href: "/practice",
    label: "Practice",
    icon: Target,
    role: "viewer" as const,
  },
  {
    href: "/admin/approve",
    label: "Approve",
    icon: ClipboardCheck,
    role: "officer" as const,
  },
  {
    href: "/admin/upload",
    label: "Upload",
    icon: FileUp,
    role: "officer" as const,
  },
  {
    href: "/admin/manage",
    label: "Manage",
    icon: Shield,
    role: "admin" as const,
  },
  {
    href: "/admin/audit",
    label: "Audit",
    icon: History,
    role: "admin" as const,
  },
];

export function AppShell({
  currentUser,
  schoolName = "Obra D Tompkins High School",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleItems = navItems.filter((item) =>
    roleMeets(currentUser.role, item.role)
  );

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-court-line bg-court-black/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Link href="/dashboard" className="group flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 shadow-opal">
                <BarChart3 className="h-6 w-6" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <div className="truncate text-xl font-black italic uppercase leading-none text-white">
                  SciOly 2K
                </div>
                <div className="mt-1 truncate text-[11px] font-bold uppercase tracking-wide text-zinc-500 sm:text-xs">
                  {schoolName}
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={signOut}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-court-line bg-court-panel text-zinc-300 transition hover:border-red-400 hover:text-white md:hidden"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <nav className="flex min-w-max gap-1 rounded-md border border-court-line bg-court-panel p-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center gap-2 rounded px-3 text-[11px] font-black uppercase tracking-wide text-zinc-400 transition hover:bg-white/5 hover:text-white sm:text-xs",
                        active &&
                          "bg-white text-black hover:bg-white hover:text-black"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <Link
                href={`/profile/${currentUser.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-court-line bg-court-panel px-3 py-2 transition hover:border-cyan-400/60 lg:w-48 lg:flex-none"
              >
                <Avatar name={currentUser.name} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">
                    {currentUser.name}
                  </div>
                  <div className="truncate text-[11px] font-black uppercase text-cyan-300">
                    {currentUser.role}
                  </div>
                </div>
              </Link>

              <button
                type="button"
                onClick={signOut}
                className="hidden h-11 w-11 shrink-0 place-items-center rounded-md border border-court-line bg-court-panel text-zinc-300 transition hover:border-red-400 hover:text-white md:grid"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 py-6 lg:px-6">
        {children}
      </main>
    </div>
  );
}
