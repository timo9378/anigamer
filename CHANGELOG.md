# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-28

### Added

- Initial release.
- `AniGamer` client with `history()`, `historyAll()`, `animeInfo()`, `cover()`.
- Cookie jar utilities: `parseCookieString`, `serializeCookies`, `mergeSetCookies`, `validateBahamutCookies`.
- JWT helpers for BAHARUNE: `decodeJwtPayload`, `checkJwtExpiry`.
- Cookie auto-rotation: `Set-Cookie` headers from Bahamut are merged into the jar and exposed via the `onCookiesRotated` callback for persistence.
- Live integration test (`pnpm test:integration`) — opt-in via `BAHAMUT_COOKIE` env.
- Dual ESM/CJS build, full TypeScript types, zero runtime deps.

[Unreleased]: https://github.com/timo9378/anigamer/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/timo9378/anigamer/releases/tag/v0.1.0
