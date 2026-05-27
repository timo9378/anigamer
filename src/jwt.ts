/**
 * Decode a JWT *payload* without verifying the signature.
 *
 * Bahamut signs BAHARUNE with their own private key — we can't verify,
 * but we can read `exp` to warn the caller before requests start failing.
 *
 * Returns null on any parse failure (bad base64, not 3 segments, invalid JSON).
 */
export function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(padded, 'base64').toString('utf-8')
        : atob(padded);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export interface JwtExpiry {
  expiresAt: Date;
  secondsUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

/**
 * Check how close BAHARUNE is to expiring.
 * - `isExpiringSoon` = under 24h left
 * - `null` if jwt is malformed or has no `exp` claim
 */
export function checkJwtExpiry(jwt: string, soonThresholdSec = 86_400): JwtExpiry | null {
  const payload = decodeJwtPayload<{ exp?: number }>(jwt);
  if (!payload?.exp || typeof payload.exp !== 'number') return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const secondsUntilExpiry = payload.exp - nowSec;
  return {
    expiresAt: new Date(payload.exp * 1000),
    secondsUntilExpiry,
    isExpired: secondsUntilExpiry <= 0,
    isExpiringSoon: secondsUntilExpiry > 0 && secondsUntilExpiry < soonThresholdSec,
  };
}
