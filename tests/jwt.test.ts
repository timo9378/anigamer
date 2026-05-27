import { describe, expect, it } from 'vitest';
import { checkJwtExpiry, decodeJwtPayload } from '../src/jwt.js';

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake-signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const jwt = makeJwt({ sub: '42', exp: 1781125200 });
    expect(decodeJwtPayload(jwt)).toEqual({ sub: '42', exp: 1781125200 });
  });

  it('returns null on garbage', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
    expect(decodeJwtPayload('only.two')).toBeNull();
    expect(decodeJwtPayload('a.b.c.d')).toBeNull();
    expect(decodeJwtPayload('a.!@#.c')).toBeNull();
  });
});

describe('checkJwtExpiry', () => {
  it('flags expired tokens', () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) - 100 });
    const status = checkJwtExpiry(jwt);
    expect(status?.isExpired).toBe(true);
    expect(status?.isExpiringSoon).toBe(false);
  });

  it('flags tokens expiring within 24h', () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const status = checkJwtExpiry(jwt);
    expect(status?.isExpired).toBe(false);
    expect(status?.isExpiringSoon).toBe(true);
  });

  it('healthy when expiry is far away', () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 86_400 * 14 });
    const status = checkJwtExpiry(jwt);
    expect(status?.isExpired).toBe(false);
    expect(status?.isExpiringSoon).toBe(false);
  });

  it('returns null when payload has no exp', () => {
    const jwt = makeJwt({ sub: 'no-exp' });
    expect(checkJwtExpiry(jwt)).toBeNull();
  });
});
