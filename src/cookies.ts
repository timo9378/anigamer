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
 * Parse a single `Set-Cookie` header line into `{ name, value, deleted }`.
 *
 * Deletion is detected when the server signals expiry — i.e. one of:
 *   - `Max-Age` ≤ 0
 *   - `expires` is in the past
 *   - the literal value is `deleted` AND any expiry-style attribute is present
 *     (Bahamut + many PHP backends use `Set-Cookie: foo=deleted; expires=1970…; Max-Age=0`)
 *
 * Returns null on malformed input.
 */
function parseSetCookieLine(
  line: string,
  now: number = Date.now(),
): { name: string; value: string; deleted: boolean } | null {
  const segments = line.split(';');
  const head = segments[0];
  if (!head) return null;
  const idx = head.indexOf('=');
  if (idx < 0) return null;
  const name = head.slice(0, idx).trim();
  const value = head.slice(idx + 1).trim();
  if (!name) return null;

  let maxAgeDeletion = false;
  let expiresInPast = false;
  let hasExpiryAttr = false;

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;
    const eq = segment.indexOf('=');
    const attrName = (eq < 0 ? segment : segment.slice(0, eq)).trim().toLowerCase();
    const attrValue = eq < 0 ? '' : segment.slice(eq + 1).trim();
    if (attrName === 'max-age') {
      hasExpiryAttr = true;
      const ageNum = Number.parseInt(attrValue, 10);
      // Max-Age takes precedence over Expires per RFC 6265 §5.3; ≤ 0 means delete now
      if (Number.isFinite(ageNum) && ageNum <= 0) maxAgeDeletion = true;
    } else if (attrName === 'expires') {
      hasExpiryAttr = true;
      const t = Date.parse(attrValue);
      if (Number.isFinite(t) && t <= now) expiresInPast = true;
    }
  }

  // Literal `deleted` is just a PHP-ism — only treat as deletion when paired with an expiry attr
  const deletedSentinel = value === 'deleted' && hasExpiryAttr;
  const deleted = maxAgeDeletion || expiresInPast || deletedSentinel;
  return { name, value, deleted };
}

/**
 * Merge `Set-Cookie` response header values into the jar.
 * Mutates `jar` in place. Returns true if anything changed.
 *
 * Accepts either a string (single header) or string[] (Node's combined form).
 *
 * Cookie deletion (Max-Age≤0 / past expires / `foo=deleted; expires=1970…`) is
 * honoured — matching cookies are removed from the jar rather than overwritten
 * with the deletion sentinel. Other attributes (Path, HttpOnly, Secure, …) are
 * still dropped.
 */
export function mergeSetCookies(
  jar: CookieJar,
  setCookie: string | string[] | null | undefined,
): boolean {
  if (!setCookie) return false;
  const lines = Array.isArray(setCookie) ? setCookie : [setCookie];
  let changed = false;
  const now = Date.now();
  for (const line of lines) {
    const parsed = parseSetCookieLine(line, now);
    if (!parsed) continue;
    const { name, value, deleted } = parsed;
    if (deleted) {
      if (name in jar) {
        delete jar[name];
        changed = true;
      }
      continue;
    }
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
