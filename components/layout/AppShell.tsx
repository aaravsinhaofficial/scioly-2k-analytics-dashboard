"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  FileUp,
  FileBarChart,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  NotebookPen,
  CircleHelp,
  Shield,
  Search,
  Target,
  Users,
  X,
} from "lucide-react";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Student, UserRole } from "@/lib/types";
import { cn, roleMeets } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LiveRefresh } from "@/components/layout/LiveRefresh";
import { NavigationProgress } from "@/components/layout/NavigationProgress";

const GlobalSearch = dynamic(
  () => import("@/components/search/GlobalSearch").then((module) => module.GlobalSearch),
  { ssr: false }
);

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

interface SidebarContentProps {
  currentUser: Student;
  pathname: string;
  shortcutLabel: string;
  navigationIdPrefix: string;
  onNavigate?: () => void;
  onOpenSearch: (trigger: HTMLElement) => void;
  onStartTour: () => void;
  onSignOut: () => void;
}

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Team workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, role: "viewer" },
      { href: "/points", label: "Log practice", icon: NotebookPen, role: "viewer" },
      { href: "/testoffs", label: "Testoff rankings", icon: ClipboardList, role: "viewer" },
      { href: "/teams", label: "Teams", icon: Users, role: "viewer" },
    ],
  },
  {
    label: "Preparation",
    items: [
      { href: "/practice", label: "Practice library", icon: Target, role: "viewer" },
      { href: "/resources", label: "Event resources", icon: BookOpen, role: "viewer" },
      { href: "/admin/library", label: "Manage event library", icon: BookOpen, role: "viewer" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin/approve", label: "Approval queue", icon: ClipboardCheck, role: "officer" },
      { href: "/admin/testoffs", label: "Enter testoff scores", icon: ClipboardList, role: "officer" },
      { href: "/admin/upload", label: "Import results", icon: FileUp, role: "officer" },
      { href: "/admin/manage", label: "Manage team", icon: Shield, role: "admin" },
      { href: "/admin/reports", label: "Reports", icon: FileBarChart, role: "admin" },
      { href: "/admin/audit", label: "Audit log", icon: History, role: "admin" },
    ],
  },
];

const mobileItems = [
  { href: "/dashboard", label: "Home", accessibleLabel: "Dashboard", icon: LayoutDashboard },
  { href: "/points", label: "Log", accessibleLabel: "Log practice", icon: NotebookPen },
  { href: "/practice", label: "Practice", accessibleLabel: "Practice library", icon: Target },
  { href: "/resources", label: "Resources", accessibleLabel: "Event resources", icon: BookOpen },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Navigation({
  pathname,
  role,
  idPrefix,
  onNavigate,
}: {
  pathname: string;
  role: UserRole;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-6" aria-label="Main navigation" data-tour="navigation">
      {navGroups.map((group, groupIndex) => {
        const items = group.items.filter((item) => roleMeets(role, item.role));
        if (items.length === 0) return null;
        const headingId = `${idPrefix}-group-${groupIndex}`;

        return (
          <section
            key={group.label}
            aria-labelledby={headingId}
            data-tour={group.label === "Administration" ? "administration" : undefined}
          >
            <h2 id={headingId} className="mb-2 px-3 text-xs font-semibold text-zinc-500">
              {group.label}
            </h2>
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      data-tour={item.href === "/points" ? "points-nav" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-md border-l-2 border-transparent px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-court-elevated hover:text-white",
                        active && "border-cyan-400 bg-cyan-400/10 font-semibold text-cyan-300"
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  currentUser,
  pathname,
  shortcutLabel,
  navigationIdPrefix,
  onNavigate,
  onOpenSearch,
  onStartTour,
  onSignOut,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col bg-court-panel">
      <div className="flex h-[76px] items-center border-b border-court-line px-5">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3" onClick={onNavigate}>
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
        <Navigation
          pathname={pathname}
          role={currentUser.role}
          idPrefix={navigationIdPrefix}
          onNavigate={onNavigate}
        />
      </div>

      <div className="border-t border-court-line p-3">
        <div role="group" aria-label="Workspace tools">
          <button
            type="button"
            onClick={(event) => onOpenSearch(event.currentTarget)}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-court-elevated hover:text-white"
            aria-keyshortcuts="Meta+K Control+K"
            data-tour-return="search-trigger"
          >
            <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            Search
            <span className="ml-auto text-xs text-zinc-500" aria-hidden="true">{shortcutLabel}</span>
          </button>
          <ThemeToggle />
          <button
            type="button"
            onClick={onStartTour}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-court-elevated hover:text-white"
            data-tour-return="tour-trigger"
          >
            <CircleHelp className="h-[18px] w-[18px]" aria-hidden="true" />
            Take a tour
          </button>
        </div>

        <div className="mt-1" role="group" aria-label="Your account">
          <Link
            href={`/profile/${currentUser.id}`}
            onClick={onNavigate}
            className="flex min-w-0 items-center gap-3 rounded-md p-2 transition-colors hover:bg-court-elevated"
            aria-label={`Open ${currentUser.name}'s profile (${currentUser.role})`}
          >
            <Avatar name={currentUser.name} src={currentUser.profilePictureUrl} size="sm" />
            <span className="min-w-0 flex-1" aria-hidden="true">
              <span className="block truncate text-sm font-semibold text-white">{currentUser.name}</span>
              <span className="block text-xs capitalize text-zinc-500">{currentUser.role}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-zinc-600 transition-colors hover:bg-red-300/10 hover:text-red-300"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K");
  const searchReturnFocusRef = useRef<HTMLElement | null>(null);
  const menuDialogRef = useRef<HTMLDivElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuReturnFocusRef = useRef<HTMLElement | null>(null);

  const currentPage = useMemo(() => {
    const match = navGroups.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href));
    if (match) return match.label;
    if (pathname.startsWith("/profile/")) return "Student profile";
    return "SciOly Tracker";
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
    menuReturnFocusRef.current = null;
  }, [pathname]);

  useEffect(() => {
    setShortcutLabel(/Mac|iPhone|iPad/.test(window.navigator.platform) ? "⌘ K" : "Ctrl K");
  }, []);

  useEffect(() => {
    const openFromKeyboard = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      const target = event.target;
      const editable = target instanceof HTMLElement && (
        target.matches("input, textarea, select") || target.isContentEditable
      );
      const commandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slashShortcut = event.key === "/" && !editable && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!commandShortcut && !slashShortcut) return;
      const blockingModal = document.querySelector(
        'dialog[open], [role="dialog"][aria-modal="true"]:not(#mobile-navigation-dialog)'
      );
      if (!searchOpen && blockingModal) return;
      event.preventDefault();
      if (searchOpen) return;
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      searchReturnFocusRef.current = menuOpen ? menuReturnFocusRef.current : activeElement;
      menuReturnFocusRef.current = null;
      setMenuOpen(false);
      setSearchOpen(true);
    };
    window.addEventListener("keydown", openFromKeyboard);
    return () => window.removeEventListener("keydown", openFromKeyboard);
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    const openFromPage = () => {
      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      searchReturnFocusRef.current = menuOpen ? menuReturnFocusRef.current : activeElement;
      menuReturnFocusRef.current = null;
      setMenuOpen(false);
      setSearchOpen(true);
    };
    window.addEventListener("scioly:open-search", openFromPage);
    return () => window.removeEventListener("scioly:open-search", openFromPage);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const backgroundElements = Array.from(document.querySelectorAll<HTMLElement>("[data-modal-background]"));
    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => {
      element.inert = true;
    });

    const focusFrame = window.requestAnimationFrame(() => menuCloseButtonRef.current?.focus());
    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = menuDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", containFocus, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => {
        element.inert = false;
      });
      document.removeEventListener("keydown", containFocus, true);
    };
  }, [menuOpen]);

  async function signOut() {
    menuReturnFocusRef.current = null;
    setMenuOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  function openMenu(trigger: HTMLElement) {
    menuReturnFocusRef.current = trigger;
    setMenuOpen(true);
  }

  function closeMenu(restoreFocus = true) {
    const returnTarget = menuReturnFocusRef.current;
    menuReturnFocusRef.current = null;
    setMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => returnTarget?.focus());
    }
  }

  function openSearch(trigger: HTMLElement) {
    searchReturnFocusRef.current = menuOpen ? menuReturnFocusRef.current : trigger;
    menuReturnFocusRef.current = null;
    setMenuOpen(false);
    setSearchOpen(true);
  }

  function closeSearch() {
    const returnTarget = searchReturnFocusRef.current;
    searchReturnFocusRef.current = null;
    setSearchOpen(false);
    window.requestAnimationFrame(() => returnTarget?.focus());
  }

  function startTour() {
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTarget = menuOpen
      ? menuReturnFocusRef.current
      : searchOpen
        ? searchReturnFocusRef.current
        : activeElement;
    menuReturnFocusRef.current = null;
    searchReturnFocusRef.current = null;
    setMenuOpen(false);
    setSearchOpen(false);
    const returnFocusKey = returnTarget?.dataset.tourReturn;
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("scioly:start-tour", {
        detail: { returnFocus: returnTarget, returnFocusKey },
      }));
    });
  }

  return (
    <div className="min-h-screen bg-court-black lg:pl-64">
      <a href="#main-content" className="skip-link" data-modal-background>
        Skip to main content
      </a>

      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-court-line lg:block"
        aria-label="Workspace sidebar"
        data-modal-background
        data-tour-layer
      >
        <SidebarContent
          currentUser={currentUser}
          pathname={pathname}
          shortcutLabel={shortcutLabel}
          navigationIdPrefix="desktop-navigation"
          onOpenSearch={openSearch}
          onStartTour={startTour}
          onSignOut={() => void signOut()}
        />
      </aside>

      <header
        className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-court-line bg-court-panel/80 px-4 backdrop-blur-md lg:px-8"
        aria-label="Workspace toolbar"
        data-modal-background
        data-tour-layer
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={(event) => openMenu(event.currentTarget)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-court-line text-zinc-600 lg:hidden"
            aria-label="Open main navigation"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation-dialog"
            data-tour="navigation-trigger"
            data-tour-return="navigation-trigger"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{currentPage}</div>
            <div className="hidden truncate text-xs text-zinc-500 sm:block">{schoolName}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => openSearch(event.currentTarget)}
          className="mx-auto hidden h-10 min-w-0 max-w-lg flex-1 items-center gap-2 rounded-md border border-court-control bg-court-elevated px-3 text-left text-sm text-zinc-500 transition hover:border-cyan-400 hover:text-white sm:flex"
          aria-label="Search SciOly Tracker"
          aria-keyshortcuts="Meta+K Control+K"
          data-tour-return="search-trigger"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">Search pages, people, and resources</span>
          <span className="ml-auto shrink-0 rounded border border-court-line bg-court-panel px-1.5 py-0.5 text-[11px] text-zinc-500" aria-hidden="true">{shortcutLabel}</span>
        </button>

        <button
          type="button"
          onClick={(event) => openSearch(event.currentTarget)}
          className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-md border border-court-line text-zinc-600 sm:hidden"
          aria-label="Search SciOly Tracker"
          aria-keyshortcuts="Meta+K Control+K"
          data-tour-return="search-trigger"
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>

        <Link
          href={`/profile/${currentUser.id}`}
          className="flex items-center gap-2 rounded-md p-1.5 pr-2 transition-colors hover:bg-court-elevated"
          aria-label="Open your profile"
          data-tour-return="profile-trigger"
        >
          <Avatar name={currentUser.name} src={currentUser.profilePictureUrl} size="sm" />
          <span className="hidden text-sm font-medium text-white md:inline">{currentUser.name.split(" ")[0]}</span>
        </Link>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-[1480px] overflow-x-clip px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10"
        data-modal-background
      >
        {children}
      </main>

      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <LiveRefresh />
      <OnboardingTour userId={currentUser.id} role={currentUser.role} />

      {searchOpen ? (
        <GlobalSearch
          role={currentUser.role}
          userId={currentUser.id}
          onClose={closeSearch}
          onStartTour={startTour}
        />
      ) : null}

      {menuOpen ? (
        <div
          ref={menuDialogRef}
          id="mobile-navigation-dialog"
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-navigation-title"
          tabIndex={-1}
        >
          <div
            className="app-overlay absolute inset-0 h-full w-full backdrop-blur-sm"
            onClick={() => closeMenu()}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[min(88vw,320px)] border-r border-court-line shadow-panel">
            <h2 id="mobile-navigation-title" className="sr-only">Main navigation</h2>
            <button
              ref={menuCloseButtonRef}
              type="button"
              onClick={() => closeMenu()}
              className="absolute right-3 top-4 grid h-11 w-11 place-items-center rounded-md text-zinc-600"
              aria-label="Close main navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent
              currentUser={currentUser}
              pathname={pathname}
              shortcutLabel={shortcutLabel}
              navigationIdPrefix="mobile-navigation"
              onNavigate={() => closeMenu(false)}
              onOpenSearch={openSearch}
              onStartTour={startTour}
              onSignOut={() => void signOut()}
            />
          </div>
        </div>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid min-h-[calc(72px+env(safe-area-inset-bottom))] grid-cols-5 border-t border-court-line bg-court-panel px-1 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden"
        aria-label="Quick navigation"
        data-modal-background
      >
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[11px] font-medium text-zinc-500",
                active && "border-cyan-400 bg-cyan-400/10 font-semibold text-cyan-300"
              )}
              aria-current={active ? "page" : undefined}
              aria-label={item.accessibleLabel}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
              <span aria-hidden="true">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={(event) => openMenu(event.currentTarget)}
          className="flex flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[11px] font-medium text-zinc-500"
          aria-label="Open all navigation"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation-dialog"
          data-tour-return="navigation-trigger"
        >
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
          <span aria-hidden="true">More</span>
        </button>
      </nav>
    </div>
  );
}
