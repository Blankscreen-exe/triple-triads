/**
 * The FileStorage contract, run against every backend. Local storage always runs; MinIO runs when
 * MINIO_TEST_ENDPOINT (and credentials) point at a test server, as in CI.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMinioStorage } from './minio-storage';
import { createLocalStorage, isValidStorageKey, type FileStorage } from './storage';

interface Backend {
  readonly name: string;
  readonly enabled: boolean;
  setUp(): Promise<{ storage: FileStorage; tearDown: () => Promise<void> }>;
}

const minioEndpoint = process.env['MINIO_TEST_ENDPOINT'];

const BACKENDS: readonly Backend[] = [
  {
    name: 'local',
    enabled: true,
    async setUp() {
      const dir = await mkdtemp(join(tmpdir(), 'tt-storage-'));
      return {
        storage: createLocalStorage(dir),
        tearDown: () => rm(dir, { recursive: true, force: true }),
      };
    },
  },
  {
    name: 'minio',
    enabled: minioEndpoint !== undefined,
    setUp() {
      const storage = createMinioStorage({
        endPoint: minioEndpoint ?? '',
        port: Number(process.env['MINIO_TEST_PORT'] ?? '9000'),
        useSSL: false,
        accessKey: process.env['MINIO_TEST_ACCESS_KEY'] ?? 'minioadmin',
        secretKey: process.env['MINIO_TEST_SECRET_KEY'] ?? 'minioadmin',
        // A fresh bucket per test keeps tests independent.
        bucket: `tt-test-${randomUUID().slice(0, 8)}`,
      });
      return Promise.resolve({ storage, tearDown: () => Promise.resolve() });
    },
  },
];

describe.each(BACKENDS.filter((backend) => backend.enabled))('$name storage', (backend) => {
  let storage: FileStorage;
  let tearDown: () => Promise<void>;

  beforeEach(async () => {
    ({ storage, tearDown } = await backend.setUp());
  });

  afterEach(async () => {
    await tearDown();
  });

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

  it('deletes a single file and ignores missing ones', async () => {
    await storage.put('cards/abc/a.webp', Buffer.from('a'), 'image/webp');
    await storage.put('cards/abc/b.webp', Buffer.from('b'), 'image/webp');

    await storage.delete('cards/abc/a.webp');
    await storage.delete('cards/abc/missing.webp');

    expect(await storage.get('cards/abc/a.webp')).toBeNull();
    expect(await storage.get('cards/abc/b.webp')).not.toBeNull();
  });

  it('deletes everything under a folder, and only that folder', async () => {
    await storage.put('cards/abc/a.webp', Buffer.from('a'), 'image/webp');
    await storage.put('cards/abc/nested/b.webp', Buffer.from('b'), 'image/webp');
    await storage.put('cards/abcd/c.webp', Buffer.from('c'), 'image/webp');

    await storage.deleteFolder('cards/abc');
    await storage.deleteFolder('cards/never-existed');

    expect(await storage.get('cards/abc/a.webp')).toBeNull();
    expect(await storage.get('cards/abc/nested/b.webp')).toBeNull();
    expect(await storage.get('cards/abcd/c.webp')).not.toBeNull();
  });

  it('lists every stored file by key', async () => {
    expect(await storage.list()).toEqual([]);
    await storage.put('cards/abc/a.webp', Buffer.from('a'), 'image/webp');
    await storage.put('packs/default/nested/b.png', Buffer.from('b'), 'image/png');

    expect((await storage.list()).toSorted()).toEqual([
      'cards/abc/a.webp',
      'packs/default/nested/b.png',
    ]);
  });

  it('refuses keys that could escape the storage area', async () => {
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
