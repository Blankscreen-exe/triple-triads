import { describe, expect, it } from 'vitest';
import { hostMatches, isSameOrigin } from './same-origin';

const request = (headers: Record<string, string>) =>
  new Request('http://127.0.0.1:3000/admin/backup/restore', { method: 'POST', headers });

describe('isSameOrigin', () => {
  it('accepts requests from the site itself', () => {
    expect(isSameOrigin(request({ origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }))).toBe(
      true,
    );
  });

  it('uses the forwarded host behind a proxy or tunnel', () => {
    expect(
      isSameOrigin(
        request({
          origin: 'https://play.example.com',
          host: '127.0.0.1:3000',
          'x-forwarded-host': 'play.example.com, proxy.internal',
        }),
      ),
    ).toBe(true);
  });

  it('refuses other sites and requests without an origin', () => {
    expect(isSameOrigin(request({ origin: 'https://evil.example', host: '127.0.0.1:3000' }))).toBe(
      false,
    );
    expect(isSameOrigin(request({ host: '127.0.0.1:3000' }))).toBe(false);
    expect(isSameOrigin(request({ origin: 'not a url', host: '127.0.0.1:3000' }))).toBe(false);
  });

  it('accepts the allowed origins of a tunnel that forwards its own host', () => {
    const tunnel = request({
      origin: 'https://calm-sky-1.trycloudflare.com',
      host: 'localhost:3000',
    });
    expect(isSameOrigin(tunnel)).toBe(false);
    expect(isSameOrigin(tunnel, ['*.trycloudflare.com'])).toBe(true);
    expect(isSameOrigin(tunnel, ['*.example.com'])).toBe(false);
  });
});

describe('hostMatches', () => {
  it('matches hosts exactly, ignoring case', () => {
    expect(hostMatches('Play.Example.com', 'play.example.com')).toBe(true);
    expect(hostMatches('example.com', 'play.example.com')).toBe(false);
    expect(hostMatches('play.example.com:8443', 'play.example.com')).toBe(false);
  });

  it('lets * stand for one label and a leading ** for one or more', () => {
    expect(hostMatches('a.example.com', '*.example.com')).toBe(true);
    expect(hostMatches('example.com', '*.example.com')).toBe(false);
    expect(hostMatches('a.b.example.com', '*.example.com')).toBe(false);
    expect(hostMatches('a.b.example.com', '**.example.com')).toBe(true);
    expect(hostMatches('example.com', '**.example.com')).toBe(false);
    expect(hostMatches('example.com.evil.test', '*.example.com')).toBe(false);
  });
});
