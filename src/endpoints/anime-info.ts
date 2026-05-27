import { bahamutGet, type HttpContext } from '../http.js';
import type { AnimeInfo } from '../types.js';

/**
 * Fetch the public anime ref page and scrape OG meta tags.
 *
 * Why scrape instead of using an API?
 * Bahamut has no documented endpoint that returns the cover URL for a given animeSn.
 * The cover lives at a randomized hash path on p2.bahamut.com.tw — unpredictable.
 * The HTML page exposes it via `<meta property="og:image">` so we lift it from there.
 */
export async function fetchAnimeInfo(ctx: HttpContext, animeSn: number): Promise<AnimeInfo> {
  const url = `https://ani.gamer.com.tw/animeRef.php?sn=${animeSn}`;
  const res = await bahamutGet(ctx, { url, timeoutMs: 6000 });
  const html = await res.text();
  return {
    animeSn,
    cover: extractMeta(html, 'og:image'),
    title: extractMeta(html, 'og:title'),
    description: extractMeta(html, 'og:description'),
  };
}

/**
 * Convenience: get just the cover URL.
 * Useful when fetching covers for many animeSn — saves the caller a destructure.
 */
export async function fetchCover(ctx: HttpContext, animeSn: number): Promise<string | null> {
  const info = await fetchAnimeInfo(ctx, animeSn);
  return info.cover;
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta\\s+(?:property|name)=["']${property}["']\\s+content=["']([^"']+)["']`,
    'i',
  );
  const match = html.match(re);
  return match?.[1] ?? null;
}
