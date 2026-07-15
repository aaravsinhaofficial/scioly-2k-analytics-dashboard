import type { SearchCandidate } from "@/lib/search-types";

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchAnchor(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "-").slice(0, 72) || "item";
}

export function libraryContentAnchor(value: string, libraryId?: number) {
  const anchor = searchAnchor(value);
  return libraryId === undefined ? anchor : `${anchor}-${libraryId}`;
}

export function scoreSearchCandidate(candidate: SearchCandidate, rawQuery: string) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return candidate.quickRank ? 100 - candidate.quickRank : 1;

  const title = normalizeSearchText(candidate.title);
  const subtitle = normalizeSearchText(candidate.subtitle);
  const keywords = normalizeSearchText(candidate.keywords.join(" "));
  const haystack = `${title} ${subtitle} ${keywords}`;
  const tokens = query.split(" ").filter(Boolean);
  if (!tokens.every((token) => haystack.includes(token))) return 0;

  let score = 20;
  if (title === query) score += 220;
  else if (title.startsWith(query)) score += 150;
  else if (title.split(" ").some((word) => word.startsWith(query))) score += 115;
  else if (title.includes(query)) score += 90;
  if (keywords.includes(query)) score += 45;
  if (subtitle.includes(query)) score += 25;

  for (const token of tokens) {
    if (title.split(" ").some((word) => word.startsWith(token))) score += 14;
    else if (title.includes(token)) score += 8;
    if (keywords.includes(token)) score += 4;
  }

  return score;
}
