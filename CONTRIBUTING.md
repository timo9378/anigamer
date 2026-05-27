# Contributing to anigamer

Thanks for your interest! This SDK is small, so contributions are easy to review and ship.

## Quick start

```bash
git clone https://github.com/timo9378/anigamer.git
cd anigamer
pnpm install
pnpm verify     # lint + typecheck + tests + build (must pass before PR)
```

We use **pnpm** (see `packageManager` in `package.json`). Please don't commit `package-lock.json` or `yarn.lock`.

## What to work on

- **Bug fixes** — always welcome, especially for response shape mismatches (Bahamut changes their API without notice).
- **New user-data endpoints** — subscriptions, follows, comments, reactions. Scope is "your own account data behind cookie auth".
- **Better types** for fields currently typed as `unknown` (look in `src/endpoints/*.ts` for `[key: string]: unknown`).
- **Docs and examples** — especially real-world integrations (Trakt scrobbler, Discord bot, Obsidian plugin, …).

**Out of scope** (please don't PR these — they belong in different projects):

- Video downloading / DRM stream extraction → see [`aniGamerPlus`](https://github.com/miyouzi/aniGamerPlus)
- Public anime catalog data (search, episode lists) → see [`bahamut-anime`](https://github.com/JacobLinCool/bahamut-anime)
- GUI / browser extension wrappers — keep `anigamer` headless

## Adding an endpoint

1. Create `src/endpoints/<name>.ts` exporting a function that takes `HttpContext` and uses `bahamutGet`.
2. Add typed response shapes — keep the raw API shape in a `Raw*` interface, normalize to a public shape, expose `raw` for fields you haven't typed.
3. Wire it onto `AniGamer` in `src/client.ts` and re-export types from `src/index.ts`.
4. Add a unit test in `tests/` using a `fakeFetch` (`vi.fn<typeof fetch>().mockResolvedValue(new Response(...))`).
5. **Don't add a runtime dependency.** Zero deps is a hard rule — use native `fetch`, native `crypto`, regex over HTML parsing where reasonable.

## Tests

- `pnpm test` — unit tests (mocked, fast)
- `pnpm test:coverage` — with coverage report (CI enforces 90% statements / lines / functions, 80% branches)
- `pnpm test:integration` — hits the real API; gated by `BAHAMUT_COOKIE` env

The integration test is opt-in and only runs locally. CI does not run it. If you add a new endpoint, please:

- Add a unit test (required)
- Add a check to `tests/integration/real-api.js` (recommended, helps catch API shape changes)

## Code style

Biome handles everything:

```bash
pnpm lint        # check
pnpm lint:fix    # auto-fix
pnpm format      # just format
```

CI fails if `pnpm lint` finds issues. Run `pnpm lint:fix` before pushing.

## Commit messages

Conventional Commits is preferred but not enforced:

```
feat: add subscriptions endpoint
fix(history): handle string episode field for OVAs
docs: clarify cookie rotation behavior
```

## Releasing (maintainers)

1. Update `CHANGELOG.md` — move items from `[Unreleased]` to a new version section.
2. Bump `version` in `package.json` (`pnpm version patch|minor|major`).
3. Commit + tag: `git push --follow-tags`.
4. Create a GitHub release for the tag — the publish workflow does the rest (npm publish with provenance).

## Security

Found a security issue? Please follow `SECURITY.md` instead of opening a public issue.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
