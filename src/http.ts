import { mergeSetCookies, serializeCookies, type CookieJar } from './cookies.js';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface HttpContext {
  jar: CookieJar;
  fetch: typeof fetch;
  userAgent: string;
  timeoutMs: number;
  onCookiesRotated: ((jar: CookieJar) => void) | undefined;
}

export interface RequestOptions {
  url: string;
  /** Additional headers; Cookie + User-Agent are filled automatically */
  headers?: Record<string, string>;
  /** ms — overrides context default */
  timeoutMs?: number;
}

/**
 * GET helper that injects the current cookie jar, captures Set-Cookie back into the jar,
 * and invokes the rotation callback if anything changed.
 *
 * On non-2xx, throws an `Error` with the status appended.
 */
export async function bahamutGet(ctx: HttpContext, opts: RequestOptions): Promise<Response> {
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), opts.timeoutMs ?? ctx.timeoutMs);
  try {
    const res = await ctx.fetch(opts.url, {
      method: 'GET',
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        Cookie: serializeCookies(ctx.jar),
        'User-Agent': ctx.userAgent,
        Accept: '*/*',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        Referer: 'https://ani.gamer.com.tw/',
        Origin: 'https://ani.gamer.com.tw',
        ...opts.headers,
      },
    });

    // Node 18+ fetch exposes Set-Cookie via getSetCookie(); fall back to raw header.
    const setCookies =
      (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
      (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);
    if (setCookies.length > 0 && mergeSetCookies(ctx.jar, setCookies)) {
      ctx.onCookiesRotated?.(ctx.jar);
    }

    if (!res.ok) {
      throw new Error(`Bahamut request failed: ${res.status} ${res.statusText} (${opts.url})`);
    }
    return res;
  } finally {
    clearTimeout(timeout);
  }
}
