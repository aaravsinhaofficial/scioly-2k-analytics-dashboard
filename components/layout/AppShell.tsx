"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileUp,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  NotebookPen,
  CircleHelp,
  Shield,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Student, UserRole } from "@/lib/types";
import { cn, roleMeets } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

interface AppShellProps {
  currentUser: Student;
  schoolName?: string;
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  role: UserRole;
}

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Team workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, role: "viewer" },
      { href: "/points", label: "Log practice", icon: NotebookPen, role: "viewer" },
      { href: "/teams", label: "Teams", icon: Users, role: "viewer" },
      { href: "/testoffs", label: "Testoff rankings", icon: ClipboardList, role: "viewer" },
    ],
  },
  {
    label: "Preparation",
    items: [
      { href: "/resources", label: "Event resources", icon: BookOpen, role: "viewer" },
      { href: "/practice", label: "Practice library", icon: Target, role: "viewer" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/approve", label: "Approval queue", icon: ClipboardCheck, role: "officer" },
      { href: "/admin/testoffs", label: "Enter testoff scores", icon: ClipboardList, role: "officer" },
      { href: "/admin/upload", label: "Import results", icon: FileUp, role: "officer" },
      { href: "/admin/manage", label: "Manage team", icon: Shield, role: "admin" },
      { href: "/admin/audit", label: "Audit log", icon: History, role: "admin" },
    ],
  },
];

const mobileItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/points", label: "Log", icon: NotebookPen },
  { href: "/testoffs", label: "Testoffs", icon: ClipboardList },
  { href: "/resources", label: "Resources", icon: BookOpen },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role: UserRole;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6" aria-label="Main navigation" data-tour="navigation">
      {navGroups.map((group) => {
        const items = group.items.filter((item) => roleMeets(role, item.role));
        if (items.length === 0) return null;

        return (
          <div key={group.label} data-tour={group.label === "Administration" ? "administration" : undefined}>
            <div className="mb-2 px-3 text-xs font-semibold text-zinc-500">{group.label}</div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    data-tour={item.href === "/resources" ? "resources" : item.href === "/points" ? "points-nav" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-court-elevated hover:text-white",
                      active && "bg-cyan-400/10 text-cyan-300"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({
  currentUser,
  schoolName = "Obra D. Tompkins High School",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage = useMemo(() => {
    const match = navGroups.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href));
    if (match) return match.label;
    if (pathname.startsWith("/profile/")) return "Student profile";
    return "SciOly Tracker";
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-court-panel">
      <div className="flex h-[76px] items-center border-b border-court-line px-5">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={() => setMenuOpen(false)}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-black shadow-sm">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-white">SciOly Tracker</span>
            <span className="block truncate text-xs text-zinc-500">Tompkins Science Olympiad</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <Navigation pathname={pathname} role={currentUser.role} onNavigate={() => setMenuOpen(false)} />
      </div>

      <div className="border-t border-court-line p-3">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("scioly:start-tour"))}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-court-elevated hover:text-white"
        >
          <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
          Take a tour
        </button>
        <Link
          href={`/profile/${currentUser.id}`}
          onClick={() => setMenuOpen(false)}
          className="flex min-w-0 items-center gap-3 rounded-md p-2 transition-colors hover:bg-court-elevated"
        >
          <Avatar name={currentUser.name} src={currentUser.profilePictureUrl} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{currentUser.name}</span>
            <span className="block text-xs capitalize text-zinc-500">{currentUser.role}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-red-300/10 hover:text-red-300"
        >
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-court-black lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-court-line lg:block">
        {sidebar}
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-court-line bg-court-panel/80 px-4 backdrop-blur-md lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-court-line text-zinc-600 lg:hidden"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{currentPage}</div>
            <div className="hidden truncate text-xs text-zinc-500 sm:block">{schoolName}</div>
          </div>
        </div>

        <Link
          href={`/profile/${currentUser.id}`}
          className="flex items-center gap-2 rounded-md p-1.5 pr-2 transition-colors hover:bg-court-elevated"
          aria-label="Open your profile"
        >
          <Avatar name={currentUser.name} src={currentUser.profilePictureUrl} size="sm" />
          <span className="hidden text-sm font-medium text-white md:inline">{currentUser.name.split(" ")[0]}</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[1480px] px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
        {children}
      </main>

      <OnboardingTour userId={currentUser.id} role={currentUser.role} />

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="app-overlay absolute inset-0 h-full w-full backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,320px)] border-r border-court-line shadow-panel">
            {sidebar}
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-md text-zinc-600"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </aside>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-5 border-t border-court-line bg-court-panel px-1 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Quick navigation">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-zinc-500",
                active && "text-cyan-300"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-zinc-500"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          More
        </button>
      </nav>
    </div>
  );
}
