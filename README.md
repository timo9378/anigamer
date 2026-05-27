# anigamer

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

Requires Node 18+ (uses native `fetch`).

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
