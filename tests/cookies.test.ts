import { describe, expect, it } from 'vitest';
import {
  mergeSetCookies,
  parseCookieString,
  serializeCookies,
  validateBahamutCookies,
} from '../src/cookies.js';

describe('parseCookieString', () => {
  it('parses a typical cookie string', () => {
    const jar = parseCookieString('BAHAID=42; BAHANICK=foo; BAHALV=15');
    expect(jar).toEqual({ BAHAID: '42', BAHANICK: 'foo', BAHALV: '15' });
  });

  it('handles values containing = (e.g. base64/JWT)', () => {
    const jar = parseCookieString('BAHARUNE=eyJ.foo=.bar==; BAHAID=1');
    expect(jar.BAHARUNE).toBe('eyJ.foo=.bar==');
    expect(jar.BAHAID).toBe('1');
  });

  it('returns empty jar for null/undefined/empty input', () => {
    expect(parseCookieString(null)).toEqual({});
    expect(parseCookieString(undefined)).toEqual({});
    expect(parseCookieString('')).toEqual({});
  });

  it('skips malformed segments', () => {
    const jar = parseCookieString('BAHAID=1; ; foo; BAHALV=5');
    expect(jar).toEqual({ BAHAID: '1', BAHALV: '5' });
  });
});

describe('serializeCookies', () => {
  it('round-trips parse → serialize', () => {
    const original = 'BAHAID=42; BAHANICK=foo';
    const jar = parseCookieString(original);
    expect(serializeCookies(jar)).toBe(original);
  });
});

describe('mergeSetCookies', () => {
  it('extracts name=value, drops Path / Expires / HttpOnly attrs', () => {
    const jar: Record<string, string> = { BAHAID: 'old' };
    const changed = mergeSetCookies(jar, [
      'BAHAID=new; Path=/; Domain=.gamer.com.tw; HttpOnly',
      'BAHALV=10; Expires=Wed, 21 Oct 2026 07:28:00 GMT',
    ]);
    expect(changed).toBe(true);
    expect(jar).toEqual({ BAHAID: 'new', BAHALV: '10' });
  });

  it('returns false when no values change', () => {
    const jar = { BAHAID: '42' };
    const changed = mergeSetCookies(jar, ['BAHAID=42; Path=/']);
    expect(changed).toBe(false);
  });

  it('accepts a single string header', () => {
    const jar: Record<string, string> = {};
    mergeSetCookies(jar, 'BAHAID=x; Path=/');
    expect(jar.BAHAID).toBe('x');
  });

  it('no-ops on null / empty input', () => {
    const jar = { BAHAID: '1' };
    expect(mergeSetCookies(jar, null)).toBe(false);
    expect(mergeSetCookies(jar, [])).toBe(false);
    expect(jar).toEqual({ BAHAID: '1' });
  });

  describe('deletion semantics', () => {
    it('removes cookie when Max-Age=0', () => {
      const jar: Record<string, string> = { BAHARUNE: 'jwt-value' };
      const changed = mergeSetCookies(jar, ['BAHARUNE=anything; Max-Age=0; Path=/']);
      expect(changed).toBe(true);
      expect('BAHARUNE' in jar).toBe(false);
    });

    it('removes cookie when Max-Age is negative', () => {
      const jar: Record<string, string> = { BAHAID: '42' };
      mergeSetCookies(jar, ['BAHAID=x; Max-Age=-1']);
      expect('BAHAID' in jar).toBe(false);
    });

    it('removes cookie when expires is in the past', () => {
      const jar: Record<string, string> = { BAHAID: '42' };
      const changed = mergeSetCookies(jar, [
        'BAHAID=anything; expires=Thu, 01 Jan 1970 00:00:01 GMT; Path=/',
      ]);
      expect(changed).toBe(true);
      expect('BAHAID' in jar).toBe(false);
    });

    it('handles Bahamut/PHP style "deleted" sentinel + past expires + Max-Age=0', () => {
      // The exact pattern Bahamut sends when invalidating a web session
      const jar: Record<string, string> = {
        BAHAID: 'timo9378',
        BAHAHASHID: 'c320c9af...',
        BAHARUNE: 'eyJ0eXAi...realJWT',
      };
      const changed = mergeSetCookies(jar, [
        'BAHAID=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/',
        'BAHAHASHID=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/',
        'BAHARUNE=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/',
      ]);
      expect(changed).toBe(true);
      // All three are gone from the jar — NOT stored as "deleted" string
      expect('BAHAID' in jar).toBe(false);
      expect('BAHAHASHID' in jar).toBe(false);
      expect('BAHARUNE' in jar).toBe(false);
    });

    it('does NOT treat literal "deleted" as deletion if no expiry attr present', () => {
      // Edge case: a real cookie value that happens to be "deleted" without expiry attrs
      const jar: Record<string, string> = {};
      mergeSetCookies(jar, ['SOMETHING=deleted; Path=/']);
      expect(jar.SOMETHING).toBe('deleted');
    });

    it('keeps cookie when expires is in the future', () => {
      const jar: Record<string, string> = { BAHAID: 'old' };
      const future = new Date(Date.now() + 86_400_000).toUTCString();
      mergeSetCookies(jar, [`BAHAID=new; expires=${future}; Path=/`]);
      expect(jar.BAHAID).toBe('new');
    });

    it('returns false if deletion target was already absent', () => {
      const jar: Record<string, string> = { BAHAID: '1' };
      const changed = mergeSetCookies(jar, ['NONEXISTENT=deleted; Max-Age=0']);
      expect(changed).toBe(false);
      expect(jar.BAHAID).toBe('1');
    });

    it('mixed update + delete in one batch', () => {
      const jar: Record<string, string> = { BAHAID: 'old', BAHARUNE: 'stale-jwt' };
      const changed = mergeSetCookies(jar, [
        'BAHAID=new; Path=/',
        'BAHARUNE=deleted; expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0; path=/',
        'BAHALV=42; Path=/',
      ]);
      expect(changed).toBe(true);
      expect(jar.BAHAID).toBe('new');
      expect('BAHARUNE' in jar).toBe(false);
      expect(jar.BAHALV).toBe('42');
    });
  });
});

describe('validateBahamutCookies', () => {
  it('reports missing cookies by name', () => {
    const result = validateBahamutCookies({ BAHAID: '1', BAHARUNE: 'jwt' });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('BAHAHASHID');
    expect(result.missing).not.toContain('BAHAID');
  });

  it('ok=true when all 7 cookies present', () => {
    const result = validateBahamutCookies({
      BAHAID: '1',
      BAHAHASHID: 'h',
      BAHANICK: 'n',
      BAHALV: '5',
      BAHAFLT: 'f',
      BAHAENUR: 'e',
      BAHARUNE: 'r',
    });
    expect(result).toEqual({ ok: true, missing: [] });
  });
});
