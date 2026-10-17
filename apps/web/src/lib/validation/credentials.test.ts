import { describe, expect, it } from 'vitest';
import { credentialsSchema, USERNAME_PATTERN, usernameKey } from './credentials';

describe('USERNAME_PATTERN', () => {
  // Browsers compile the HTML `pattern` attribute with the `v` flag; an invalid pattern there is
  // silently ignored, so the form would stop validating usernames.
  it('is valid as an HTML pattern attribute (v flag)', () => {
    expect(() => new RegExp(USERNAME_PATTERN, 'v')).not.toThrow();
  });

  it.each(['Squall', 'seed_42', 'rinoa-heartilly'])('accepts %s', (name) => {
    expect(new RegExp(USERNAME_PATTERN, 'v').test(name)).toBe(true);
  });

  it.each(['two words', 'semi;colon', 'émile'])('rejects %s', (name) => {
    expect(new RegExp(USERNAME_PATTERN, 'v').test(name)).toBe(false);
  });
});

describe('credentialsSchema', () => {
  it('trims the username and enforces lengths', () => {
    expect(credentialsSchema.parse({ username: '  Zell ', password: '12345678' }).username).toBe(
      'Zell',
    );
    expect(credentialsSchema.safeParse({ username: 'ab', password: '12345678' }).success).toBe(
      false,
    );
    expect(credentialsSchema.safeParse({ username: 'Zell', password: 'short' }).success).toBe(
      false,
    );
  });
});

describe('usernameKey', () => {
  it('is case-insensitive', () => {
    expect(usernameKey(' Squall ')).toBe(usernameKey('SQUALL'));
  });
});
