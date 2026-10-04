import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { LibraryEventOption, LibraryItem, LibraryItemKind } from "@/lib/library-types";
import {
  sciolyEvents,
  type Difficulty,
  type SciolyEventHub,
  type SciolyQuestion,
  type SciolyResource,
  type SciolyTest,
} from "@/lib/resource-data";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase";

export const libraryCacheTag = "scioly-resource-library";

interface LibraryItemRow {
  id: number | string;
  event_slug: string;
  event_name: string;
  kind: LibraryItemKind;
  title: string;
  description?: string | null;
  topic?: string | null;
  difficulty?: Difficulty | null;
  resource_type?: string | null;
  url?: string | null;
  body?: string | null;
  answer?: string | null;
  explanation?: string | null;
  test_format?: SciolyTest["format"] | null;
  is_featured?: boolean | null;
  is_active?: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function libraryItemFromRow(row: LibraryItemRow): LibraryItem {
  const createdAt = row.created_at ?? new Date(0).toISOString();
  const eventSlug = canonicalEventSlug(row.event_slug);
  const staticEvent = sciolyEvents.find((event) => event.slug === eventSlug);
  return {
    id: Number(row.id),
    eventSlug,
    eventName: staticEvent?.name ?? row.event_name,
    kind: row.kind,
    title: row.title,
    description: optionalText(row.description),
    topic: optionalText(row.topic),
    difficulty: row.difficulty ?? undefined,
    resourceType: optionalText(row.resource_type),
    url: optionalText(row.url),
    body: optionalText(row.body),
    answer: optionalText(row.answer),
    explanation: optionalText(row.explanation),
    testFormat: row.test_format ?? undefined,
    isFeatured: Boolean(row.is_featured),
    isActive: row.is_active !== false,
    createdBy: row.created_by ?? undefined,
    createdAt,
    updatedAt: row.updated_at ?? createdAt,
  };
}

async function queryLibraryItems(includeInactive: boolean) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  let query = supabase.from("library_items").select("*").order("updated_at", { ascending: false });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;

  // Existing deployments can use the static library until the additive schema
  // migration has been applied.
  if (error) return [];
  return (data ?? []).map((row) => libraryItemFromRow(row as LibraryItemRow));
}

const loadCachedActiveLibraryItems = unstable_cache(
  () => queryLibraryItems(false),
  [libraryCacheTag, "active"],
  { revalidate: 60, tags: [libraryCacheTag] }
);

async function queryConfiguredEventNames() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase.from("events").select("name").order("name");
  if (error) return [];
  return (data ?? []).map((row) => optionalText(row.name)).filter((name): name is string => Boolean(name));
}

const loadCachedConfiguredEventNames = unstable_cache(
  queryConfiguredEventNames,
  [libraryCacheTag, "event-names"],
  { revalidate: 60, tags: [libraryCacheTag] }
);

export async function getManagedLibraryItems() {
  if (!hasSupabaseAdminConfig()) return [];
  return queryLibraryItems(true);
}

export function invalidateLibraryCache() {
  revalidateTag(libraryCacheTag);
}

function normalizedTitle(value: string) {
  return value.trim().toLocaleLowerCase();
}

function mergeNamed<T extends { title: string }>(fallback: T[], managed: T[]) {
  const managedTitles = new Set(managed.map((item) => normalizedTitle(item.title)));
  return [...fallback.filter((item) => !managedTitles.has(normalizedTitle(item.title))), ...managed];
}

function itemToResource(item: LibraryItem): SciolyResource {
  return {
    libraryId: item.id,
    title: item.title,
    type: item.kind === "guide" ? "Guide" : (item.resourceType as SciolyResource["type"] | undefined) ?? "Guide",
    topic: item.topic ?? "General",
    difficulty: item.difficulty ?? "Rookie",
    description: item.description ?? item.body?.slice(0, 180) ?? "Team-contributed event resource.",
    recommended: item.isFeatured,
    url: item.url,
    body: item.body,
    managed: true,
  };
}

function itemToQuestion(item: LibraryItem): SciolyQuestion {
  return {
    libraryId: item.id,
    topic: item.topic ?? "General",
    difficulty: item.difficulty ?? "Rookie",
    question: item.title,
    answer: item.answer ?? "Answer not supplied",
    explanation: item.explanation ?? item.description ?? "No explanation supplied yet.",
    managed: true,
  };
}

function itemToTest(item: LibraryItem): SciolyTest {
  return {
    libraryId: item.id,
    title: item.title,
    format: item.testFormat ?? "Mini Test",
    difficulty: item.difficulty ?? "Rookie",
    description: item.description ?? "Team-contributed practice test.",
    url: item.url,
    body: item.body,
    managed: true,
  };
}

function cloneStaticEvent(event: SciolyEventHub): SciolyEventHub {
  return {
    ...event,
    starterPath: [...event.starterPath],
    topics: [...event.topics],
    resources: event.resources.map((item) => ({ ...item })),
    questions: event.questions.map((item) => ({ ...item })),
    tests: event.tests.map((item) => ({
      ...item,
      questions: item.questions?.map((question) => ({ ...question })),
    })),
  };
}

function liveOnlyEvent(slug: string, name: string, items: LibraryItem[]): SciolyEventHub {
  const topics = Array.from(new Set(items.map((item) => item.topic).filter((item): item is string => Boolean(item))));
  return {
    name,
    slug,
    category: "Study",
    coverageScore: Math.min(100, 20 + items.length * 12),
    readiness: items.length >= 4 ? "Building" : "Needs Uploads",
    lead: "Team library",
    tagline: "Team-contributed resources and practice for this event.",
    description: `Use this event library to find the team's current resources, questions, guides, and practice tests for ${name}.`,
    starterPath: [
      "Open the most relevant guide or resource for your current topic.",
      "Answer a practice question before checking its answer and explanation.",
      "Use a mini or full test to identify the next area to review.",
    ],
    topics: topics.length ? topics : ["General"],
    resources: [],
    questions: [],
    tests: [],
  };
}

export async function getLibraryEvents(): Promise<SciolyEventHub[]> {
  const configured = hasSupabaseAdminConfig();
  const liveItems = configured ? await loadCachedActiveLibraryItems() : [];
  const bySlug = new Map(sciolyEvents.map((event) => [event.slug, cloneStaticEvent(event)]));
  const grouped = new Map<string, LibraryItem[]>();
  for (const item of liveItems) {
    const items = grouped.get(item.eventSlug);
    if (items) items.push(item);
    else grouped.set(item.eventSlug, [item]);
  }

  for (const [slug, items] of grouped) {
    const event = bySlug.get(slug) ?? liveOnlyEvent(slug, items[0]?.eventName ?? slug, items);
    const resources = items.filter((item) => item.kind === "resource" || item.kind === "guide").map(itemToResource);
    const questions = items.filter((item) => item.kind === "question").map(itemToQuestion);
    const tests = items.filter((item) => item.kind === "test").map(itemToTest);
    event.resources = mergeNamed(event.resources, resources);
    event.questions = mergeNamed(event.questions.map((question) => ({ ...question, title: question.question })), questions.map((question) => ({ ...question, title: question.question })))
      .map(({ title: _title, ...question }) => question);
    event.tests = mergeNamed(event.tests, tests);
    event.topics = Array.from(new Set([...event.topics, ...items.map((item) => item.topic).filter((item): item is string => Boolean(item))]));
    event.coverageScore = Math.min(100, Math.max(event.coverageScore, 25 + (event.resources.length + event.questions.length + event.tests.length) * 5));
    event.readiness = event.resources.length + event.questions.length + event.tests.length >= 6 ? "Loaded" : "Building";
    bySlug.set(slug, event);
  }

  return Array.from(bySlug.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export async function getLibraryEvent(slug: string) {
  const canonicalSlug = canonicalEventSlug(slug);
  return (await getLibraryEvents()).find((event) => event.slug === canonicalSlug);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const eventSlugAliases = new Map([
  ["anatomy-physiology", "anatomy-and-physiology"],
  ["rocks-minerals", "rocks-and-minerals"],
]);

function canonicalEventSlug(value: string) {
  const slug = slugify(value);
  return eventSlugAliases.get(slug) ?? slug;
}

export async function getLibraryEventOptions(): Promise<LibraryEventOption[]> {
  const options = new Map<string, LibraryEventOption>(
    sciolyEvents.map((event) => [event.slug, { slug: event.slug, name: event.name }])
  );
  const items = await getManagedLibraryItems();
  for (const item of items) {
    const slug = canonicalEventSlug(item.eventSlug);
    const staticEvent = sciolyEvents.find((event) => event.slug === slug);
    options.set(slug, { slug, name: staticEvent?.name ?? item.eventName });
  }

  if (hasSupabaseAdminConfig()) {
    for (const name of await loadCachedConfiguredEventNames()) {
      const slug = canonicalEventSlug(name);
      const staticEvent = sciolyEvents.find((event) => event.slug === slug);
      if (slug && !options.has(slug)) options.set(slug, { slug, name: staticEvent?.name ?? name });
    }
  }

  return Array.from(options.values()).sort((left, right) => left.name.localeCompare(right.name));
}
