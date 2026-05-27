export interface HistoryEntry {
  animeSn: number;
  videoSn: number;
  title: string;
  /** Episode number as a string ("12", "OVA", etc) — Bahamut sometimes uses non-numeric labels */
  episode?: string;
  /**
   * Thumbnail cover URL included directly in the history response
   * (e.g. `https://p2.bahamut.com.tw/B/ACG/c/.../xxx.JPG`).
   * Lower-res than the og:image from {@link AnimeInfo.cover} but free — no extra request.
   */
  cover?: string;
  /** Episode runtime in minutes, as reported by Bahamut */
  duration?: number;
  /** Watch timestamp, e.g. "2026-05-27 13:20:00" (Bahamut's local time, not ISO) */
  watchedAt?: string;
  /** Raw entry from API, exposed for fields we haven't typed yet */
  raw?: unknown;
}

export interface HistoryPage {
  entries: HistoryEntry[];
  /** Current page (1-indexed) */
  page: number;
  /** Total pages reported by API */
  totalPage: number;
}

export interface AnimeInfo {
  animeSn: number;
  /** og:image URL — the cover image; randomized hash path, can't be predicted from sn */
  cover: string | null;
  title: string | null;
  description: string | null;
}

export interface ClientOptions {
  /**
   * Cookie source. Accepts either a raw cookie string (e.g. value of `document.cookie`
   * or `-b '...'` from `curl --copy-as-curl`) OR a pre-parsed jar.
   */
  cookie: string | Record<string, string>;
  /** Per-request timeout in ms. Default 8000. */
  timeoutMs?: number;
  /** Override User-Agent. Default mimics a desktop Chrome. */
  userAgent?: string;
  /**
   * Called whenever Bahamut rotates cookies via Set-Cookie. Receives the updated jar.
   * Use this to persist cookies to disk so the next process starts with fresh ones.
   */
  onCookiesRotated?: (jar: Record<string, string>) => void;
  /** Custom fetch implementation. Defaults to global `fetch`. */
  fetch?: typeof fetch;
}
