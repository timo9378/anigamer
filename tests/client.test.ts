import { describe, expect, it, vi } from 'vitest';
import { AniGamer } from '../src/client.js';

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('AniGamer', () => {
  it('accepts cookie as a string', () => {
    const client = new AniGamer({ cookie: 'BAHAID=42; BAHARUNE=jwt' });
    expect(client.cookies.BAHAID).toBe('42');
    expect(client.validate().missing).toContain('BAHANICK');
  });

  it('accepts cookie as a jar object', () => {
    const client = new AniGamer({ cookie: { BAHAID: '1', BAHARUNE: 'x' } });
    expect(client.cookies.BAHAID).toBe('1');
  });

  it('reports JWT status from BAHARUNE', () => {
    const jwt = makeJwt({ exp: Math.floor(Date.now() / 1000) + 86_400 * 7 });
    const client = new AniGamer({ cookie: { BAHARUNE: jwt } });
    const status = client.jwtStatus();
    expect(status?.isExpired).toBe(false);
    expect(status?.secondsUntilExpiry).toBeGreaterThan(0);
  });

  it('history() sends Cookie header and captures rotated cookies', async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            history: [{ animeSn: 100, videoSn: 200, title: '進擊的巨人', episode: '1' }],
            totalPage: 1,
          },
        }),
        {
          status: 200,
          headers: new Headers([
            ['content-type', 'application/json'],
            ['set-cookie', 'BAHARUNE=rotated-jwt; Path=/'],
          ]),
        },
      ),
    );

    const onCookiesRotated = vi.fn();
    const client = new AniGamer({
      cookie: 'BAHAID=42; BAHARUNE=old-jwt',
      fetch: fakeFetch,
      onCookiesRotated,
    });

    const page = await client.history(1);
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]?.title).toBe('進擊的巨人');

    const [url, init] = fakeFetch.mock.calls[0]!;
    expect(url).toContain('history.php?page=1');
    expect((init?.headers as Record<string, string>).Cookie).toContain('BAHAID=42');

    expect(client.cookies.BAHARUNE).toBe('rotated-jwt');
    expect(onCookiesRotated).toHaveBeenCalledOnce();
  });

  it('historyAll() walks pages and de-dupes', async () => {
    const fakeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            history: [
              { animeSn: 1, videoSn: 10, title: 'A' },
              { animeSn: 1, videoSn: 11, title: 'A' },
            ],
            totalPage: 2,
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            history: [
              { animeSn: 1, videoSn: 11, title: 'A' }, // duplicate
              { animeSn: 2, videoSn: 20, title: 'B' },
            ],
            totalPage: 2,
          },
        }),
      );

    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    const all = await client.historyAll({ delayMs: 0 });
    expect(all).toHaveLength(3);
    expect(all.map((e) => `${e.animeSn}:${e.videoSn}`)).toEqual(['1:10', '1:11', '2:20']);
  });

  it('animeInfo() extracts og:image from HTML', async () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://p2.bahamut.com.tw/B/ACG/c/ab/cd123.JPG">
        <meta property="og:title" content="進擊的巨人 最終季">
      </head></html>
    `;
    const fakeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
      );
    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    const info = await client.animeInfo(12345);
    expect(info.cover).toBe('https://p2.bahamut.com.tw/B/ACG/c/ab/cd123.JPG');
    expect(info.title).toBe('進擊的巨人 最終季');
  });

  it('throws on non-2xx response', async () => {
    const fakeFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('forbidden', { status: 403, statusText: 'Forbidden' }));
    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    await expect(client.history(1)).rejects.toThrow(/403/);
  });

  it('throws when fetch is unavailable', () => {
    expect(
      () => new AniGamer({ cookie: 'x', fetch: 'not-a-function' as unknown as typeof fetch }),
    ).toThrow(/fetch unavailable/);
  });

  it('cover() returns just the og:image URL', async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`<meta property="og:image" content="https://p2.bahamut.com.tw/cover.jpg">`, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    expect(await client.cover(999)).toBe('https://p2.bahamut.com.tw/cover.jpg');
  });

  it('animeInfo returns null cover when og:image missing', async () => {
    const fakeFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html><head><title>nope</title></head></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    const info = await client.animeInfo(1);
    expect(info.cover).toBeNull();
    expect(info.title).toBeNull();
  });

  it('historyAll uses default options when none supplied', async () => {
    let n = 0;
    const fakeFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      n += 1;
      return jsonResponse({
        data: {
          history: n === 1 ? [{ animeSn: 1, videoSn: 1, title: 'A' }] : [],
          totalPage: 1,
        },
      });
    });
    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    const result = await client.historyAll();
    expect(result).toHaveLength(1);
  });

  it('historyAll honors maxPages cap', async () => {
    let n = 0;
    const fakeFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      n += 1;
      return jsonResponse({
        data: {
          history: [{ animeSn: n, videoSn: n * 10, title: `page-${n}` }],
          totalPage: 999,
        },
      });
    });
    const client = new AniGamer({ cookie: 'BAHAID=1', fetch: fakeFetch });
    const result = await client.historyAll({ maxPages: 3, delayMs: 0 });
    expect(fakeFetch).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
  });
});
