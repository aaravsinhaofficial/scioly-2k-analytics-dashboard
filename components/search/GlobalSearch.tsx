"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Loader2,
  Search,
  TestTube2,
  UserRound,
  Users,
  X
} from "lucide-react";
import { pageSearchCandidatesForUser } from "@/lib/search-pages";
import type { SearchCandidate, SearchResponse, SearchResult, SearchResultGroup } from "@/lib/search-types";
import { normalizeSearchText, scoreSearchCandidate } from "@/lib/search-utils";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GlobalSearchProps {
  role: UserRole;
  userId: string;
  onClose: () => void;
  onStartTour: () => void;
}

const queryCache = new Map<string, SearchResult[]>();
const groupOrder: SearchResultGroup[] = [
  "Quick actions",
  "Pages",
  "Administration",
  "Students",
  "Teams",
  "Events",
  "Resources",
  "Practice",
  "Testoffs"
];

function ResultIcon({ kind }: { kind: SearchResult["kind"] }) {
  const Icon = kind === "student"
    ? UserRound
    : kind === "team"
      ? Users
      : kind === "event" || kind === "resource"
        ? BookOpen
        : kind === "question" || kind === "test" || kind === "testoff"
          ? TestTube2
          : kind === "action"
            ? CircleHelp
            : kind === "page"
              ? LayoutDashboard
              : FileText;
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  const normalized = query.trim();
  if (!normalized) return value;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = value.split(new RegExp(`(${escaped})`, "ig"));
  return parts.map((part, index) => part.toLowerCase() === normalized.toLowerCase()
    ? <mark key={`${part}-${index}`} className="rounded bg-cyan-400/15 text-inherit">{part}</mark>
    : part);
}

function resultId(index: number) {
  return `global-search-result-${index}`;
}

function cacheResults(key: string, results: SearchResult[]) {
  if (queryCache.size >= 25) {
    const oldestKey = queryCache.keys().next().value;
    if (typeof oldestKey === "string") queryCache.delete(oldestKey);
  }
  queryCache.set(key, results);
}

export function GlobalSearch({ role, userId, onClose, onStartTour }: GlobalSearchProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const pageCandidates = useMemo(
    () => pageSearchCandidatesForUser(role, userId),
    [role, userId]
  );
  const normalizedQuery = normalizeSearchText(query);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (normalizedQuery.length < 2) {
      setRemoteResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = `${role}:${normalizedQuery}`;
    const cached = queryCache.get(cacheKey);
    if (cached) {
      setRemoteResults(cached);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, {
          signal: controller.signal,
          headers: { accept: "application/json" }
        });
        const payload = await response.json() as SearchResponse;
        if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Search could not load.");
        cacheResults(cacheKey, payload.results);
        setRemoteResults(payload.results);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setRemoteResults([]);
        setError(caught instanceof Error ? caught.message : "Search could not load.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedQuery, retryKey, role]);

  const results = useMemo(() => {
    const local = pageCandidates
      .map((candidate) => ({ ...candidate, score: scoreSearchCandidate(candidate, normalizedQuery) }))
      .filter((candidate) => candidate.score > 0)
      .map(({ keywords: _keywords, minimumRole: _minimumRole, quickRank: _quickRank, ...result }) => result);
    const merged = new Map<string, SearchResult>();
    for (const result of [...local, ...remoteResults]) {
      const previous = merged.get(result.id);
      if (!previous || (result.score ?? 0) > (previous.score ?? 0)) merged.set(result.id, result);
    }
    const all = Array.from(merged.values());

    return groupOrder.flatMap((group) => all
      .filter((result) => result.group === group)
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0) || left.title.localeCompare(right.title)))
      .slice(0, 20);
  }, [normalizedQuery, pageCandidates, remoteResults]);

  useEffect(() => setActiveIndex(0), [normalizedQuery, remoteResults]);

  const groupedResults = useMemo(
    () => groupOrder.flatMap((group) => {
      const items = results.map((result, index) => ({ result, index })).filter(({ result }) => result.group === group);
      return items.length ? [{ group, items }] : [];
    }),
    [results]
  );

  function choose(result: SearchResult) {
    if (navigatingId) return;
    setNavigatingId(result.id);
    if (result.action === "tour") {
      onStartTour();
      return;
    }
    onClose();
    if (result.href) {
      window.dispatchEvent(new Event("scioly:navigation-start"));
      router.push(result.href);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => results.length ? (current + 1) % results.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => results.length ? (current - 1 + results.length) % results.length : 0);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(Math.max(0, results.length - 1));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="global-search-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden border-0 bg-court-panel p-0 text-white shadow-panel sm:inset-x-0 sm:bottom-auto sm:top-[10vh] sm:mx-auto sm:h-auto sm:max-h-[80dvh] sm:w-[min(640px,calc(100vw-32px))] sm:rounded-md sm:border sm:border-court-control"
      aria-labelledby="global-search-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-full min-h-0 flex-col bg-court-panel pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:max-h-[80dvh] sm:p-0">
        <h2 id="global-search-title" className="sr-only">Search SciOly Tracker</h2>
        <div className="flex items-center gap-3 border-b border-court-line px-4 py-3 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search pages, students, teams, events, and resources"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="global-search-results"
            aria-activedescendant={results[activeIndex] ? resultId(activeIndex) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, students, teams, events, and resources"
            className="min-h-12 min-w-0 flex-1 border-0 bg-transparent px-0 text-base text-white outline-none placeholder:text-zinc-500 focus:border-0 sm:text-sm"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="grid h-10 w-10 place-items-center rounded-md text-zinc-600 hover:bg-court-elevated hover:text-white" aria-label="Clear search">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-md text-zinc-600 hover:bg-court-elevated hover:text-white" aria-label="Close search">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          id="global-search-results"
          role="listbox"
          aria-busy={loading}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 sm:max-h-[560px] sm:px-3"
        >
          {!normalizedQuery ? (
            <p className="px-3 pb-3 text-sm text-zinc-500">Search the whole workspace or jump to a common task.</p>
          ) : null}

          {groupedResults.map(({ group, items }) => (
            <section key={group} role="group" aria-labelledby={`search-group-${group.replace(/\s+/g, "-").toLowerCase()}`} className="mb-3 last:mb-0">
              <h3 id={`search-group-${group.replace(/\s+/g, "-").toLowerCase()}`} className="px-3 pb-1.5 text-xs font-semibold text-zinc-500">{group}</h3>
              <div className="space-y-1">
                {items.map(({ result, index }) => {
                  const active = index === activeIndex;
                  return (
                    <div
                      id={resultId(index)}
                      key={result.id}
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => choose(result)}
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition-colors",
                        active ? "bg-cyan-400/10 text-white" : "text-zinc-600 hover:bg-court-elevated hover:text-white"
                      )}
                    >
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md border border-court-line bg-court-elevated", active && "border-cyan-400/40 text-cyan-300")}>
                        {navigatingId === result.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ResultIcon kind={result.kind} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold"><HighlightedText value={result.title} query={query} /></span>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{result.subtitle}</span>
                      </span>
                      <ArrowRight className={cn("h-4 w-4 shrink-0", active ? "text-cyan-300" : "text-zinc-500")} aria-hidden="true" />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {loading ? (
            <div className="space-y-2 px-3 py-3" aria-hidden="true">
              {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-md bg-court-elevated" />)}
            </div>
          ) : null}

          {!loading && normalizedQuery.length === 1 ? (
            <div className="px-3 py-5 text-center text-sm text-zinc-500">Type one more character to search students, teams, events, and resources.</div>
          ) : null}

          {!loading && normalizedQuery.length >= 2 && results.length === 0 && !error ? (
            <div className="px-4 py-10 text-center">
              <p className="font-medium text-white">No results for “{query.trim()}”</p>
              <p className="mt-1 text-sm text-zinc-500">Try a student name, event, team, resource, or page.</p>
            </div>
          ) : null}

          {error ? (
            <div className="mx-3 my-3 rounded-md border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300" role="alert">
              <div>{error}</div>
              <button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-2 rounded-md border border-red-400/40 px-3 text-xs font-semibold hover:bg-red-400/10">Retry team search</button>
            </div>
          ) : null}
        </div>

        <div className="hidden items-center justify-between border-t border-court-line px-5 py-2.5 text-xs text-zinc-500 sm:flex">
          <span>{loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}`}</span>
          <span>↑↓ Navigate · Enter Open · Esc Close</span>
        </div>
        <div className="sr-only" role="status" aria-live="polite">
          {loading ? "Searching" : `${results.length} search result${results.length === 1 ? "" : "s"}`}
        </div>
      </div>
    </dialog>
  );
}
