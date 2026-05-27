export type CookieJar = Record<string, string>;

export function parseCookieString(s: string | null | undefined): CookieJar {
  const out: CookieJar = {};
  if (!s) return out;
  for (const kv of s.split(';')) {
    const idx = kv.indexOf('=');
    if (idx < 0) continue;
    const k = kv.slice(0, idx).trim();
    const v = kv.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export function serializeCookies(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Merge `Set-Cookie` response header values into the jar.
 * Mutates `jar` in place. Returns true if anything changed.
 *
 * Accepts either a string (single header) or string[] (Node's combined form).
 * Only the `name=value` pair is kept — attributes (Path, Expires, HttpOnly) are dropped.
 */
export function mergeSetCookies(
  jar: CookieJar,
  setCookie: string | string[] | null | undefined,
): boolean {
  if (!setCookie) return false;
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie];
  let changed = false;
  for (const line of lines) {
    const head = line.split(';')[0];
    if (!head) continue;
    const idx = head.indexOf('=');
    if (idx < 0) continue;
    const name = head.slice(0, idx).trim();
    const value = head.slice(idx + 1).trim();
    if (!name) continue;
    if (jar[name] !== value) {
      jar[name] = value;
      changed = true;
    }
  }
  return changed;
}

/**
 * The 7 cookies Bahamut needs for authenticated requests.
 * Used by `validateBahamutCookies()` to give early feedback.
 */
export const REQUIRED_BAHAMUT_COOKIES = [
  'BAHAID',
  'BAHAHASHID',
  'BAHANICK',
  'BAHALV',
  'BAHAFLT',
  'BAHAENUR',
  'BAHARUNE',
] as const;

export function validateBahamutCookies(jar: CookieJar): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_BAHAMUT_COOKIES.filter((k) => !jar[k]);
  return { ok: missing.length === 0, missing };
}
