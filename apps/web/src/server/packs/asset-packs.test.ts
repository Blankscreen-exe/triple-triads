import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ASSET_PACK } from '@/lib/asset-packs';
import type { AppDatabase } from '../db/client';
import { createLocalStorage, type FileStorage } from '../storage/storage';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import {
  DEFAULT_PACK_OWNER,
  getAssetPack,
  getPackFiles,
  listCustomPacks,
  resetPack,
  resetPackPart,
  uploadPackPart,
} from './asset-packs';

const png = (width: number, height: number, format: 'png' | 'jpeg' = 'png') => {
  const base = sharp({
    create: { width, height, channels: 4, background: { r: 10, g: 80, b: 200, alpha: 1 } },
  });
  return (format === 'png' ? base.png() : base.jpeg()).toBuffer();
};

let dir: string;
let storage: FileStorage;
let db: AppDatabase;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'tt-packs-'));
  storage = createLocalStorage(dir);
  db = createTestDatabase();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('uploadPackPart', () => {
  it('stores a correctly sized image and uses it in the player’s pack', async () => {
    const user = await createTestUser(db);

    expect(await uploadPackPart(db, storage, user.id, 'stars', await png(120, 60))).toEqual({
      ok: true,
    });

    const pack = getAssetPack(db, user.id);
    expect(pack.images.stars).toMatch(
      new RegExp(`^/media/packs/${user.id}/stars-[0-9a-f]{12}\\.png$`),
    );
    expect(pack.images.frame).toBe(DEFAULT_ASSET_PACK.images.frame);
  });

  it('rejects images of the wrong size, saying what is expected', async () => {
    const user = await createTestUser(db);

    expect(await uploadPackPart(db, storage, user.id, 'frame', await png(1000, 1400))).toEqual({
      ok: false,
      error: 'WRONG_SIZE',
      expected: '1024 × 1434',
    });
  });

  it('rejects JPEG and non-images', async () => {
    const user = await createTestUser(db);

    expect(
      (await uploadPackPart(db, storage, user.id, 'stars', await png(120, 60, 'jpeg'))).ok,
    ).toBe(false);
    expect(await uploadPackPart(db, storage, user.id, 'stars', Buffer.from('nope'))).toMatchObject({
      error: 'NOT_AN_IMAGE',
    });
  });

  it('accepts fonts by signature and gives them a unique family name', async () => {
    const user = await createTestUser(db);
    const woff2 = Buffer.concat([Buffer.from('wOF2', 'latin1'), Buffer.alloc(64)]);

    expect(await uploadPackPart(db, storage, user.id, 'font', woff2)).toEqual({ ok: true });
    expect(
      await uploadPackPart(db, storage, user.id, 'font', Buffer.from('<script>')),
    ).toMatchObject({
      error: 'NOT_A_FONT',
    });

    const { font } = getAssetPack(db, user.id);
    expect(font?.url).toMatch(/\.woff2$/);
    expect(font?.family).toMatch(/^pack-[0-9a-f]{12}$/);
  });

  it('deletes the replaced file when a part is uploaded again', async () => {
    const user = await createTestUser(db);
    await uploadPackPart(db, storage, user.id, 'stars', await png(120, 60));
    const first = getPackFiles(db, user.id).stars ?? '';

    const second = await sharp({
      create: { width: 120, height: 60, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    await uploadPackPart(db, storage, user.id, 'stars', second);

    expect(getPackFiles(db, user.id).stars).not.toBe(first);
    expect(await storage.get(first)).toBeNull();
  });
});

describe('effective packs', () => {
  it('layer the admin’s default-pack changes under each player’s own', async () => {
    const user = await createTestUser(db);
    await uploadPackPart(db, storage, DEFAULT_PACK_OWNER, 'cardBack', await png(1024, 1434));
    await uploadPackPart(db, storage, DEFAULT_PACK_OWNER, 'stars', await png(120, 60));
    await uploadPackPart(db, storage, user.id, 'stars', await png(120, 60));

    const pack = getAssetPack(db, user.id);

    expect(pack.images.cardBack).toContain(`/packs/${DEFAULT_PACK_OWNER}/`);
    expect(pack.images.stars).toContain(`/packs/${user.id}/`);
  });

  it('go back to the default when a part is reset', async () => {
    const user = await createTestUser(db);
    await uploadPackPart(db, storage, user.id, 'stars', await png(120, 60));

    await resetPackPart(db, storage, user.id, 'stars');

    expect(getAssetPack(db, user.id).images.stars).toBe(DEFAULT_ASSET_PACK.images.stars);
  });
});

describe('moderation', () => {
  it('lists players with custom packs and resets a whole pack', async () => {
    const user = await createTestUser(db, 'painter');
    await uploadPackPart(db, storage, user.id, 'stars', await png(120, 60));

    expect(listCustomPacks(db)).toEqual([{ userId: user.id, username: 'painter', parts: 1 }]);

    await resetPack(db, storage, user.id);
    expect(listCustomPacks(db)).toEqual([]);
    expect(getAssetPack(db, user.id).images.stars).toBe(DEFAULT_ASSET_PACK.images.stars);
  });
});
