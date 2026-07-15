export const GOOGLE_SHEETS_URL_MAX_LENGTH = 2048;

const DEFAULT_MAX_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;
const spreadsheetIdPattern = /^[A-Za-z0-9_-]{20,200}$/;
const resourceKeyPattern = /^[A-Za-z0-9_-]{1,200}$/;

export class GoogleSheetsCsvError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleSheetsCsvError";
    this.status = status;
  }
}

export interface GoogleSheetsCsvSource {
  exportUrl: string;
  spreadsheetId: string;
  gid: string;
  published: boolean;
}

interface FetchGoogleSheetsCsvOptions {
  maxBytes?: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

function singleUrlValue(values: string[], label: string) {
  if (values.some((value) => !value)) {
    throw new GoogleSheetsCsvError(`The Google Sheets ${label} is invalid. Copy the link from the selected tab and try again.`, 400);
  }
  const unique = Array.from(new Set(values));
  if (unique.length > 1) {
    throw new GoogleSheetsCsvError(`The Google Sheets link contains conflicting ${label} values. Copy a fresh link from the selected tab.`, 400);
  }
  return unique[0];
}

/**
 * Parse a user-supplied Google Sheets link, then reconstruct a fixed Google CSV
 * endpoint. The submitted URL is never fetched directly, which keeps this
 * server-side feature from becoming an arbitrary URL/SSRF proxy.
 */
export function parseGoogleSheetsUrl(input: string): GoogleSheetsCsvSource {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > GOOGLE_SHEETS_URL_MAX_LENGTH) {
    throw new GoogleSheetsCsvError("Paste a Google Sheets URL copied from the selected tab.", 400);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new GoogleSheetsCsvError("Paste a valid Google Sheets URL copied from the selected tab.", 400);
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "docs.google.com" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new GoogleSheetsCsvError("Only HTTPS links from docs.google.com/spreadsheets are supported.", 400);
  }

  const publishedMatch = url.pathname.match(/^\/spreadsheets\/d\/e\/([A-Za-z0-9_-]{20,200})(?:\/|$)/);
  const standardMatch = url.pathname.match(/^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,200})(?:\/|$)/);
  const spreadsheetId = publishedMatch?.[1] ?? standardMatch?.[1];
  if (!spreadsheetId || !spreadsheetIdPattern.test(spreadsheetId)) {
    throw new GoogleSheetsCsvError("Paste a Google Sheets URL copied from the selected tab.", 400);
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const gidValues = [...url.searchParams.getAll("gid"), ...hashParams.getAll("gid")];
  const gid = singleUrlValue(gidValues, "tab ID") ?? "0";
  const gidNumber = Number(gid);
  if (!/^\d{1,10}$/.test(gid) || !Number.isSafeInteger(gidNumber) || gidNumber < 0 || gidNumber > 2147483647) {
    throw new GoogleSheetsCsvError("The selected Google Sheets tab ID is invalid. Copy a fresh link from that tab.", 400);
  }

  const resourceKeyValues = [
    ...url.searchParams.getAll("resourcekey"),
    ...hashParams.getAll("resourcekey"),
  ];
  const resourceKey = singleUrlValue(resourceKeyValues, "resource key");
  if (resourceKey && !resourceKeyPattern.test(resourceKey)) {
    throw new GoogleSheetsCsvError("The Google Sheets resource key is invalid. Copy a fresh sharing link.", 400);
  }

  const published = Boolean(publishedMatch);
  const exportUrl = published
    ? new URL(`https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pub`)
    : new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
  exportUrl.searchParams.set("gid", gid);
  if (published) {
    exportUrl.searchParams.set("single", "true");
    exportUrl.searchParams.set("output", "csv");
  } else {
    exportUrl.searchParams.set("headers", "1");
    exportUrl.searchParams.set("tq", "limit 501");
    exportUrl.searchParams.set("tqx", "out:csv");
  }
  if (resourceKey) exportUrl.searchParams.set("resourcekey", resourceKey);

  return {
    exportUrl: exportUrl.toString(),
    spreadsheetId,
    gid,
    published,
  };
}

async function readLimitedCsv(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new GoogleSheetsCsvError("The Google Sheet is too large. The limit is 512 KB.", 413);
  }

  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new GoogleSheetsCsvError("The Google Sheet is too large. The limit is 512 KB.", 413);
    }
    return new TextDecoder().decode(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel();
      throw new GoogleSheetsCsvError("The Google Sheet is too large. The limit is 512 KB.", 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function responseError(response: Response) {
  if (response.status >= 300 && response.status < 400) {
    return new GoogleSheetsCsvError(
      "This sheet is not publicly readable. Set General access to Anyone with the link (Viewer), then try again.",
      422,
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new GoogleSheetsCsvError(
      "This sheet is not publicly readable. Set General access to Anyone with the link (Viewer), then try again.",
      422,
    );
  }
  if (response.status === 404) {
    return new GoogleSheetsCsvError("The spreadsheet or selected tab could not be found.", 404);
  }
  if (response.status === 429) {
    return new GoogleSheetsCsvError("Google temporarily rate-limited this sheet. Try again shortly.", 429);
  }
  return new GoogleSheetsCsvError("Google Sheets could not provide this spreadsheet right now.", 502);
}

function publishedRedirectUrl(response: Response, source: GoogleSheetsCsvSource) {
  const location = response.headers.get("location");
  if (!source.published || !location) return null;

  let url: URL;
  try {
    url = new URL(location, response.url || source.exportUrl);
  } catch {
    return null;
  }

  const allowedHost = /^doc-[a-z0-9]{2}-[a-z0-9]{2}-sheets\.googleusercontent\.com$/.test(url.hostname.toLowerCase());
  const allowedPath = url.pathname.startsWith("/pub/") && url.pathname.endsWith(`/e@${source.spreadsheetId}`);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !allowedHost ||
    !allowedPath
  ) {
    return null;
  }
  return url.toString();
}

export async function fetchPublicGoogleSheetCsv(
  input: string,
  options: FetchGoogleSheetsCsvOptions = {},
) {
  const source = parseGoogleSheetsUrl(input);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestInit: RequestInit = {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { Accept: "text/csv" },
    signal: controller.signal,
  };

  try {
    let response = await fetcher(source.exportUrl, requestInit);
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = publishedRedirectUrl(response, source);
      if (!redirectUrl) throw responseError(response);
      response = await fetcher(redirectUrl, requestInit);
    }
    if (!response.ok) throw responseError(response);

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "text/csv") {
      throw new GoogleSheetsCsvError(
        "Google returned a sign-in or access page instead of spreadsheet data. Check the Sheet sharing settings.",
        422,
      );
    }

    const rawCsv = await readLimitedCsv(response, maxBytes);
    if (!rawCsv.trim()) {
      throw new GoogleSheetsCsvError("The selected Google Sheets tab is empty.", 422);
    }
    return { rawCsv, source };
  } catch (error) {
    if (error instanceof GoogleSheetsCsvError) throw error;
    if (controller.signal.aborted) {
      throw new GoogleSheetsCsvError("Google Sheets did not respond within 8 seconds.", 504);
    }
    throw new GoogleSheetsCsvError("Google Sheets could not be reached. Try again shortly.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
