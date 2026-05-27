import { describe, it, expect } from 'vitest';
import {
  parseCookieString,
  serializeCookies,
  mergeSetCookies,
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
