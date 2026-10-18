import { describe, expect, it } from 'vitest';
import { isSameOrigin } from './same-origin';

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
});
