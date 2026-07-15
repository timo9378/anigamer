# anigamer

> 🦀 **Rust 版**：[crates.io/crates/anigamer](https://crates.io/crates/anigamer)（[timo9378/anigamer-rs](https://github.com/timo9378/anigamer-rs)）— 測試套件 1:1 對齊本套件。

[![CI](https://github.com/timo9378/anigamer/actions/workflows/ci.yml/badge.svg)](https://github.com/timo9378/anigamer/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/anigamer.svg)](https://www.npmjs.com/package/anigamer)
[![npm downloads](https://img.shields.io/npm/dm/anigamer.svg)](https://www.npmjs.com/package/anigamer)
[![bundle size](https://img.shields.io/bundlephobia/minzip/anigamer)](https://bundlephobia.com/package/anigamer)
[![codecov](https://codecov.io/gh/timo9378/anigamer/branch/main/graph/badge.svg)](https://codecov.io/gh/timo9378/anigamer)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![types: TypeScript](https://img.shields.io/npm/types/anigamer.svg)](https://www.typescriptlang.org/)

Unofficial SDK for **巴哈姆特動畫瘋** (`ani.gamer.com.tw`) — user-data side: watch history, cover URLs, cookie auto-rotation.

> Not affiliated with 巴哈姆特 / Gamer Digital Inc. Use at your own risk; respect their TOS.

## Why this exists

There's an OSS gap. Existing projects (`aniGamerPlus`, `AniGamerDownloader`, `anigamerdatabase`, `bahamut-anime`) cover **downloading** or **public catalog data**. None give you a typed, dependency-free API for your **own** account data — what you've watched, when, and their covers.

If you want to build a "what I'm watching" widget, sync to Trakt, feed an LLM your watch history, etc — `anigamer` does the auth dance and gives you typed entries.

## Install

```bash
pnpm add anigamer
```

Requires Node 20+ (uses native `fetch`).

## Quick start

```ts
import { AniGamer } from 'anigamer';

const client = new AniGamer({
  cookie: process.env.BAHAMUT_COOKIE!, // raw cookie string or { name: value } object
});

const page = await client.history(1);
console.log(page.entries); // [{ animeSn, videoSn, title, episode, watchedAt }, ...]

const all = await client.historyAll(); // walks all pages, de-dups
const info = await client.animeInfo(page.entries[0].animeSn);
console.log(info.cover); // og:image URL on p2.bahamut.com.tw
```

## Getting your cookie

1. Log into `ani.gamer.com.tw`
2. Open DevTools → Network → trigger any `api.gamer.com.tw` request
3. Right-click → **Copy as cURL** → grab the `-b '...'` value
4. Paste as `BAHAMUT_COOKIE` env (or directly into `new AniGamer({ cookie })`)

The 7 required cookies: `BAHAID`, `BAHAHASHID`, `BAHANICK`, `BAHALV`, `BAHAFLT`, `BAHAENUR`, `BAHARUNE`.

`BAHARUNE` is a JWT signed by Bahamut with ~14-day expiry.

## Cookie auto-rotation

Bahamut periodically rotates `BAHARUNE` via `Set-Cookie` on API responses. The SDK captures and merges these into its in-memory jar automatically. To **persist** the rotated jar across process restarts:

```ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { AniGamer } from 'anigamer';

const COOKIE_FILE = '.anigamer-cookies.json';
const jar = existsSync(COOKIE_FILE) ? JSON.parse(readFileSync(COOKIE_FILE, 'utf8')) : undefined;

const client = new AniGamer({
  cookie: jar ?? process.env.BAHAMUT_COOKIE!,
  onCookiesRotated: (rotated) => writeFileSync(COOKIE_FILE, JSON.stringify(rotated, null, 2)),
});
```

As long as your process makes Bahamut requests regularly, the JWT keeps renewing — you may never need to re-grab your cookie manually.

## JWT expiry check

Inspect the token without making a request:

```ts
const status = client.jwtStatus();
if (status?.isExpiringSoon) console.warn('JWT expires at', status.expiresAt);
if (status?.isExpired) console.error('JWT expired — re-grab cookie.');
```

## Authentication & session lifetime

**This SDK does not — and intentionally will not — perform automated login.**

Bahamut's login is gated by Google reCAPTCHA. The only ways to bypass it (paid captcha-solving services, headless browsers with human interaction, token forgery) are fragile, against Bahamut's ToS, and a good way to get a project taken down. So `anigamer` stays **read-only on your own account data, using a cookie you provide**. We never log in for you, never automate in-app actions (sign-in, lottery, quiz answering), and never store your password.

What that means for "set it and forget it":

- `BAHARUNE` (the auth JWT) has a fixed expiry of ~14 days.
- While your process keeps making requests, Bahamut **may** rotate the cookie via `Set-Cookie` — the SDK captures and persists this automatically (see [Cookie auto-rotation](#cookie-auto-rotation)). This is best-effort renewal, not guaranteed.
- Whether rotation actually extends the session indefinitely is **not something we can promise** — it depends on Bahamut's server behavior, which is undocumented and may change.

**The robust pattern is "runs automatically, warns loudly before it dies":**

```ts
const status = client.jwtStatus();
if (status?.isExpiringSoon) {
  // < 24h left — fire your own alert (Discord / email / log) so you can refresh in time
  notify(`Bahamut cookie expires ${status.expiresAt.toISOString()} — re-grab it.`);
}
```

When the cookie does expire, refreshing it is a ~5-minute manual step (log in on the website, copy the cookie again). The SDK gives you the early warning; it can't do the re-login itself.

### Detecting a dead session

A valid-looking `BAHARUNE` (not expired per `jwtStatus()`) can still be **dead** server-side — e.g. a shared account logged in from elsewhere, or Bahamut invalidating the session. The history API then answers `{"error":{"status":"NO_LOGIN"}}` with **HTTP 200**, so a status-code check won't catch it. Since v0.2.2 the SDK surfaces this as a typed throw instead of a silently-empty result:

```ts
import { AniGamer, BahamutApiError } from 'anigamer';

try {
  const all = await client.historyAll();
} catch (e) {
  if (e instanceof BahamutApiError && e.isAuthError) {
    notify('Bahamut session dead (NO_LOGIN) — refresh the cookie.'); // more reliable than jwtStatus alone
  } else throw e;
}
```

### Companion: one-click cookie refresh (optional)

Refreshing the cookie is manual, but it needn't be painful. This repo ships an **optional** companion browser extension under [`browser-extension/`](browser-extension/): after you log into 動畫瘋 it reads the cookies (incl. the HttpOnly `BAHARUNE`, which page JS / bookmarklets can't) and POSTs them to a small endpoint on **your own** backend, which hot-swaps the live client and re-syncs — no env edits, no restart. It's backend-agnostic (endpoint URL / header / paths are all configurable) and entirely optional; the SDK works fine without it. See [`browser-extension/README.md`](browser-extension/README.md) for the expected endpoint contract.

## API

### `new AniGamer(options)`

| option              | type                                    | default              |
|---------------------|-----------------------------------------|----------------------|
| `cookie`            | `string \| Record<string, string>`      | **required**         |
| `timeoutMs`         | `number`                                | `8000`               |
| `userAgent`         | `string`                                | desktop Chrome UA    |
| `onCookiesRotated`  | `(jar) => void`                         | —                    |
| `fetch`             | `typeof fetch`                          | `globalThis.fetch`   |

### Methods

- `client.history(page = 1): Promise<HistoryPage>` — one page (~24 entries)
- `client.historyAll(opts?): Promise<HistoryEntry[]>` — all pages, de-duplicated by `animeSn:videoSn`
- `client.animeInfo(animeSn): Promise<AnimeInfo>` — scrape OG meta from `animeRef.php`
- `client.cover(animeSn): Promise<string | null>` — shortcut for `animeInfo(sn).then(i => i.cover)`
- `client.validate(): { ok, missing }` — check required cookies present
- `client.jwtStatus(): JwtExpiry | null` — BAHARUNE expiry without a network call

### Standalone helpers

```ts
import {
  parseCookieString,
  serializeCookies,
  mergeSetCookies,
  decodeJwtPayload,
  checkJwtExpiry,
} from 'anigamer';
```

## Scope

**In scope (v0.x):** user-data endpoints behind cookie auth — history, anime info, eventually subscriptions/follows/comments.

**Out of scope:** video downloading (see `aniGamerPlus`), public anime catalog data (see `bahamut-anime`), DRM/m3u8 stream extraction.

## License

MIT © timo9378
