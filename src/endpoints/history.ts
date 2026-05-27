import { bahamutGet, type HttpContext } from '../http.js';
import type { HistoryEntry, HistoryPage } from '../types.js';

interface RawHistoryResponse {
  data?: {
    history?: Array<{
      animeSn: number;
      videoSn: number;
      title: string;
      episode?: string | number;
      cover?: string;
      duration?: number;
      /** Bahamut's field name for the watch timestamp */
      watchTime?: string;
      [key: string]: unknown;
    }>;
    totalPage?: number;
  };
}

function normalizeEntry(
  raw: NonNullable<NonNullable<RawHistoryResponse['data']>['history']>[number],
): HistoryEntry {
  const entry: HistoryEntry = {
    animeSn: raw.animeSn,
    videoSn: raw.videoSn,
    title: raw.title,
    raw,
  };
  if (raw.episode != null) entry.episode = String(raw.episode);
  if (raw.cover) entry.cover = raw.cover;
  if (typeof raw.duration === 'number') entry.duration = raw.duration;
  if (raw.watchTime) entry.watchedAt = raw.watchTime;
  return entry;
}

/**
 * Fetch a single page of watch history.
 *
 * Bahamut paginates ~24 entries per page. `totalPage` in the response tells you
 * when to stop; pages beyond that return an empty `history` array.
 */
export async function fetchHistoryPage(ctx: HttpContext, page: number): Promise<HistoryPage> {
  const url = `https://api.gamer.com.tw/anime/v3/history.php?page=${page}`;
  const res = await bahamutGet(ctx, { url });
  const data = (await res.json()) as RawHistoryResponse;
  const rawEntries = data?.data?.history ?? [];
  return {
    entries: rawEntries.map(normalizeEntry),
    page,
    totalPage: data?.data?.totalPage ?? page,
  };
}

export interface FetchAllHistoryOptions {
  /** Safety cap on pages walked. Default 20. */
  maxPages?: number;
  /** ms to wait between page requests. Default 500. */
  delayMs?: number;
}

/**
 * Walk all pages of watch history and return a flat, de-duplicated array.
 *
 * De-dup key: `${animeSn}:${videoSn}`. Within the same call, the first occurrence wins
 * (Bahamut returns most-recent first, so this preserves the latest watch order).
 */
export async function fetchAllHistory(
  ctx: HttpContext,
  options: FetchAllHistoryOptions = {},
): Promise<HistoryEntry[]> {
  const maxPages = options.maxPages ?? 20;
  const delayMs = options.delayMs ?? 500;
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchHistoryPage(ctx, page);
    if (result.entries.length === 0) break;
    for (const entry of result.entries) {
      const key = `${entry.animeSn}:${entry.videoSn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
    }
    if (page >= result.totalPage) break;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}
