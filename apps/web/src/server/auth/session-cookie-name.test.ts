import { describe, expect, it } from 'vitest';
import { readCookie } from './session-cookie-name';

describe('readCookie', () => {
  it('finds a cookie among several', () => {
    expect(readCookie('theme=dark; tt_session=abc123; lang=en', 'tt_session')).toBe('abc123');
  });

  it('decodes URL-encoded values', () => {
    expect(readCookie('name=hello%20world', 'name')).toBe('hello world');
  });

  it('returns null when the cookie is missing or malformed', () => {
    expect(readCookie(undefined, 'tt_session')).toBeNull();
    expect(readCookie('other=1', 'tt_session')).toBeNull();
    expect(readCookie('tt_session=%E0%A4%A', 'tt_session')).toBeNull();
  });

  it('does not match on a cookie whose name merely ends with the name', () => {
    expect(readCookie('xtt_session=nope', 'tt_session')).toBeNull();
  });
});
