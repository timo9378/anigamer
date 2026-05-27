import {
  parseCookieString,
  validateBahamutCookies,
  type CookieJar,
} from './cookies.js';
import { checkJwtExpiry, type JwtExpiry } from './jwt.js';
import { DEFAULT_USER_AGENT, type HttpContext } from './http.js';
import { fetchHistoryPage, fetchAllHistory, type FetchAllHistoryOptions } from './endpoints/history.js';
import { fetchAnimeInfo, fetchCover } from './endpoints/anime-info.js';
import type { AnimeInfo, ClientOptions, HistoryEntry, HistoryPage } from './types.js';

export class AniGamer {
  readonly #ctx: HttpContext;

  constructor(options: ClientOptions) {
    const jar: CookieJar =
      typeof options.cookie === 'string' ? parseCookieString(options.cookie) : { ...options.cookie };

    this.#ctx = {
      jar,
      fetch: options.fetch ?? globalThis.fetch,
      userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
      timeoutMs: options.timeoutMs ?? 8000,
      onCookiesRotated: options.onCookiesRotated,
    };

    if (typeof this.#ctx.fetch !== 'function') {
      throw new Error(
        'anigamer: global fetch unavailable — Node 18+ required, or pass `fetch` in options.',
      );
    }
  }

  /** Current cookie jar (live reference — do not mutate). */
  get cookies(): Readonly<CookieJar> {
    return this.#ctx.jar;
  }

  /** Returns `{ ok, missing }`. `ok=false` means a required Bahamut cookie is missing. */
  validate(): { ok: boolean; missing: string[] } {
    return validateBahamutCookies(this.#ctx.jar);
  }

  /**
   * Decode BAHARUNE and report expiry status without making a request.
   * Returns null if BAHARUNE is missing or malformed.
   */
  jwtStatus(): JwtExpiry | null {
    const baharune = this.#ctx.jar.BAHARUNE;
    return baharune ? checkJwtExpiry(baharune) : null;
  }

  /** Fetch one page of watch history. */
  history(page = 1): Promise<HistoryPage> {
    return fetchHistoryPage(this.#ctx, page);
  }

  /** Walk all pages and return a de-duplicated, flat array of entries. */
  historyAll(options?: FetchAllHistoryOptions): Promise<HistoryEntry[]> {
    return fetchAllHistory(this.#ctx, options);
  }

  /** Scrape `animeRef.php` for cover / title / description via OG meta tags. */
  animeInfo(animeSn: number): Promise<AnimeInfo> {
    return fetchAnimeInfo(this.#ctx, animeSn);
  }

  /** Shortcut for `animeInfo(sn).then(i => i.cover)`. */
  cover(animeSn: number): Promise<string | null> {
    return fetchCover(this.#ctx, animeSn);
  }
}
