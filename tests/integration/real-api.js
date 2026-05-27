#!/usr/bin/env node
/**
 * Live integration test against api.gamer.com.tw — gated by env.
 *
 * Run:
 *   BAHAMUT_COOKIE='BAHAID=...; BAHARUNE=...' node tests/integration/real-api.js
 *
 * Verifies end-to-end:
 *   1. Cookie validation (all 7 required cookies present)
 *   2. JWT expiry decoded from BAHARUNE
 *   3. /anime/v3/history.php returns parseable entries
 *   4. animeRef.php yields a non-null og:image cover
 *   5. Whether Bahamut rotated cookies during this session (Set-Cookie observed)
 *   6. historyAll pagination + dedup works against real data
 *
 * Exits 0 on full success, 1 on any failure. Output is human-readable + machine-parseable lines
 * (each result line starts with `OK ` or `FAIL `).
 */
import { AniGamer } from '../../dist/index.js';

const cookie = process.env.BAHAMUT_COOKIE;
if (!cookie) {
  console.error('SKIP: BAHAMUT_COOKIE env not set — integration test cannot run');
  process.exit(0);
}

let failures = 0;
const fail = (msg) => {
  console.log(`FAIL ${msg}`);
  failures += 1;
};
const ok = (msg) => console.log(`OK   ${msg}`);

let rotated = false;
const client = new AniGamer({
  cookie,
  onCookiesRotated: (jar) => {
    rotated = true;
    console.log(
      `[rotation] Set-Cookie observed — BAHARUNE length now ${jar.BAHARUNE?.length ?? 0}`,
    );
  },
});

// 1. Cookie validation
const validation = client.validate();
if (validation.ok) ok(`all 7 required cookies present`);
else fail(`missing cookies: ${validation.missing.join(', ')}`);

// 2. JWT expiry
const jwt = client.jwtStatus();
if (jwt) {
  const daysLeft = Math.floor(jwt.secondsUntilExpiry / 86400);
  ok(
    `BAHARUNE expires ${jwt.expiresAt.toISOString()} (${daysLeft}d left, expired=${jwt.isExpired})`,
  );
  if (jwt.isExpired) fail(`JWT already expired — re-grab cookie before running`);
} else {
  fail(`could not decode BAHARUNE`);
}

// 3. history page 1
let firstEntry;
try {
  const page = await client.history(1);
  if (page.entries.length === 0)
    fail(`history page 1 returned 0 entries (account has no history?)`);
  else {
    firstEntry = page.entries[0];
    ok(`history page 1: ${page.entries.length} entries, totalPage=${page.totalPage}`);
    ok(
      `  first entry: animeSn=${firstEntry.animeSn} videoSn=${firstEntry.videoSn} title="${firstEntry.title}" episode=${firstEntry.episode ?? '-'}`,
    );
  }
} catch (err) {
  fail(`history(1) threw: ${err.message}`);
}

// 4. animeInfo / cover
if (firstEntry) {
  try {
    const info = await client.animeInfo(firstEntry.animeSn);
    if (info.cover) ok(`animeInfo sn=${firstEntry.animeSn} cover=${info.cover}`);
    else fail(`animeInfo sn=${firstEntry.animeSn} returned no cover (og:image missing?)`);
    if (info.title) ok(`  og:title="${info.title}"`);
  } catch (err) {
    fail(`animeInfo threw: ${err.message}`);
  }
}

// 5. historyAll — verify pagination + dedup against real data
try {
  const all = await client.historyAll({ delayMs: 600 });
  const keys = new Set(all.map((e) => `${e.animeSn}:${e.videoSn}`));
  if (keys.size === all.length) ok(`historyAll: ${all.length} entries, all unique`);
  else fail(`historyAll dedup broken: ${all.length} entries but only ${keys.size} unique keys`);
  const uniqueAnime = new Set(all.map((e) => e.animeSn)).size;
  ok(`  → ${uniqueAnime} unique anime across ${all.length} episodes`);
} catch (err) {
  fail(`historyAll threw: ${err.message}`);
}

// 6. Rotation observation
if (rotated) ok(`cookie rotation observed during session (Set-Cookie merged + callback fired)`);
else
  console.log(
    `NOTE rotation NOT observed this session — Bahamut did not send Set-Cookie on any request`,
  );
console.log(`     (this is normal — rotation is opportunistic, not per-request)`);

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
