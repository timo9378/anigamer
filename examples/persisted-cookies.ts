import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { AniGamer, parseCookieString } from '../src/index.js';

const COOKIE_FILE = '.anigamer-cookies.json';

const jar = existsSync(COOKIE_FILE)
  ? (JSON.parse(readFileSync(COOKIE_FILE, 'utf8')) as Record<string, string>)
  : parseCookieString(process.env.BAHAMUT_COOKIE ?? '');

const client = new AniGamer({
  cookie: jar,
  onCookiesRotated: (rotated) => {
    writeFileSync(COOKIE_FILE, JSON.stringify(rotated, null, 2));
    console.log('[cookies] rotated, persisted to', COOKIE_FILE);
  },
});

const page = await client.history(1);
console.log(`Page 1: ${page.entries.length} entries`);
