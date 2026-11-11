/** Collect every page instead of silently using a database's first-page limit. */
export async function loadAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Page size must be a positive integer.");
  const rows: T[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await fetchPage(start, start + pageSize - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
