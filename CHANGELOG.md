# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-06-01

### Added

- `BahamutApiError` — thrown when a JSON endpoint returns an error envelope (e.g. `{"error":{"code":401,"message":"尚未登入","status":"NO_LOGIN"}}`). Exposes `code`, `status`, and `isAuthError` so callers can tell a session-expired failure (needs cookie refresh) apart from other API errors.

### Changed

- `history()` / `historyAll()` now **throw `BahamutApiError`** when Bahamut replies with an error envelope. These responses arrive with **HTTP 200**, so the SDK previously parsed them as an empty history and returned `[]` — making a dead session (`NO_LOGIN`) indistinguishable from "nothing watched", and letting sync jobs fail silently. Consumers relying on the old silent-empty behaviour should now catch `BahamutApiError` (or check `err.isAuthError`).

## [0.2.1] - 2026-05-28

### Fixed

- `mergeSetCookies` now honours cookie deletion semantics. Previously, `Set-Cookie: BAHARUNE=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0` (the standard PHP "kill cookie" pattern Bahamut emits when it invalidates a session) was naively stored as `BAHARUNE=deleted` because the function only read `name=value` and dropped attributes. Now `Max-Age` ≤ 0, past `expires`, and the `value=deleted` + expiry-attr combo all correctly **remove** the cookie from the jar instead. `validate()` therefore reports the cookie as missing after rotation kills it, allowing safety-net alerts to fire on the application side. ([#bahamut-rotate-deleted](https://github.com/timo9378/anigamer/issues))

## [0.2.0] - 2026-05-28

### Added

- `HistoryEntry.cover` — thumbnail cover URL included directly in the history response, so you can avoid an extra `animeInfo()` request per anime in most cases.
- `HistoryEntry.duration` — episode runtime in minutes.
- README "Authentication & session lifetime" section documenting the read-only, no-auto-login stance and the recommended "warn before expiry" pattern.

### Fixed

- `HistoryEntry.watchedAt` was always `undefined` — it read a non-existent `time` field; Bahamut's actual field is `watchTime`. Now mapped correctly.

## [0.1.0] - 2026-05-28

### Added

- Initial release.
- `AniGamer` client with `history()`, `historyAll()`, `animeInfo()`, `cover()`.
- Cookie jar utilities: `parseCookieString`, `serializeCookies`, `mergeSetCookies`, `validateBahamutCookies`.
- JWT helpers for BAHARUNE: `decodeJwtPayload`, `checkJwtExpiry`.
- Cookie auto-rotation: `Set-Cookie` headers from Bahamut are merged into the jar and exposed via the `onCookiesRotated` callback for persistence.
- Live integration test (`pnpm test:integration`) — opt-in via `BAHAMUT_COOKIE` env.
- Dual ESM/CJS build, full TypeScript types, zero runtime deps.

[Unreleased]: https://github.com/timo9378/anigamer/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/timo9378/anigamer/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/timo9378/anigamer/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/timo9378/anigamer/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/timo9378/anigamer/releases/tag/v0.1.0
