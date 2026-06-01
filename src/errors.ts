/**
 * Thrown when a Bahamut JSON endpoint returns an error envelope, e.g.
 *
 * ```json
 * {"error":{"code":401,"message":"尚未登入","status":"NO_LOGIN"}}
 * ```
 *
 * These come back with **HTTP 200**, so a status-code check alone can't catch
 * them — the SDK would otherwise silently treat a dead session as "0 entries".
 * Check {@link BahamutApiError.isAuthError} to tell a re-login-needed failure
 * apart from other API errors.
 */
export class BahamutApiError extends Error {
  /** Numeric `error.code` from Bahamut (e.g. 401). */
  readonly code: number | undefined;
  /** String `error.status` from Bahamut (e.g. "NO_LOGIN"). */
  readonly status: string | undefined;
  /** True when the session is no longer authenticated (NO_LOGIN / 401) → cookies need refreshing. */
  readonly isAuthError: boolean;

  constructor(args: {
    code?: number | undefined;
    status?: string | undefined;
    message?: string | undefined;
  }) {
    const label = args.status ?? (args.code != null ? String(args.code) : 'unknown');
    super(`Bahamut API error: ${label}${args.message ? ` — ${args.message}` : ''}`);
    this.name = 'BahamutApiError';
    this.code = args.code;
    this.status = args.status;
    this.isAuthError = args.status === 'NO_LOGIN' || args.code === 401;
  }
}
