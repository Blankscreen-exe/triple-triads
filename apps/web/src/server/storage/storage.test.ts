import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalStorage, isValidStorageKey, type FileStorage } from './storage';

let dir: string;
let storage: FileStorage;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tt-storage-'));
  storage = createLocalStorage(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('local storage', () => {
  it('stores and reads back a file with its content type', async () => {
    await storage.put('cards/abc/art-card.webp', Buffer.from('image-bytes'), 'image/webp');

    expect(await storage.get('cards/abc/art-card.webp')).toEqual({
      data: Buffer.from('image-bytes'),
      contentType: 'image/webp',
    });
  });

  it('returns null for missing files', async () => {
    expect(await storage.get('cards/missing.webp')).toBeNull();
  });

  it('deletes everything under a prefix', async () => {
    await storage.put('cards/abc/a.webp', Buffer.from('a'), 'image/webp');
    await storage.put('cards/abc/b.webp', Buffer.from('b'), 'image/webp');
    await storage.put('cards/keep/c.webp', Buffer.from('c'), 'image/webp');

    await storage.deletePrefix('cards/abc');

    expect(await storage.get('cards/abc/a.webp')).toBeNull();
    expect(await storage.get('cards/keep/c.webp')).not.toBeNull();
  });

  it('refuses keys that could escape the storage directory', async () => {
    await expect(storage.put('../outside.webp', Buffer.from('x'), 'image/webp')).rejects.toThrow();
    expect(await storage.get('cards/../../secret')).toBeNull();
  });
});

describe('isValidStorageKey', () => {
  it.each(['cards/abc/1f2e-card.webp', 'packs/default/frame.png'])('accepts %s', (key) => {
    expect(isValidStorageKey(key)).toBe(true);
  });

  it.each(['../x', 'cards//x', '/abs', 'cards/./x', 'Cards/X.webp', 'cards/x y.webp', 'cards\\x'])(
    'rejects %s',
    (key) => {
      expect(isValidStorageKey(key)).toBe(false);
    },
  );
});
