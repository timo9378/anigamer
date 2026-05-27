import { AniGamer } from '../src/index.js';

const client = new AniGamer({
  cookie: process.env.BAHAMUT_COOKIE ?? '',
});

const validation = client.validate();
if (!validation.ok) {
  console.error('Missing cookies:', validation.missing);
  process.exit(1);
}

const jwt = client.jwtStatus();
if (jwt?.isExpiringSoon) {
  console.warn(`BAHARUNE expires at ${jwt.expiresAt.toISOString()} — refresh soon.`);
}

const all = await client.historyAll();
console.log(`Found ${all.length} watched episodes.`);

const firstSn = all[0]?.animeSn;
if (firstSn) {
  const info = await client.animeInfo(firstSn);
  console.log(`Cover for sn=${firstSn}: ${info.cover}`);
}
