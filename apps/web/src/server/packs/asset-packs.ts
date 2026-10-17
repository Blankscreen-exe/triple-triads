/**
 * Uploaded asset packs (design/SPEC.md, section 7). A player can replace any part of the default
 * pack; admins can replace parts of the default pack itself. Each card is drawn with its owner's
 * effective pack: built-in default ← admin changes ← the player's own changes.
 */
import { createHash } from 'node:crypto';
import { eq, ne } from 'drizzle-orm';
import sharp, { type Metadata } from 'sharp';
import {
  IMAGE_PARTS,
  PACK_FONT_MAX_BYTES,
  PACK_IMAGE_MAX_BYTES,
  PART_FILE_NAMES,
  type ImagePart,
  type PackPart,
} from '@/lib/asset-pack-spec';
import { DEFAULT_ASSET_PACK, type AssetPack } from '@/lib/asset-packs';
import type { AppDatabase, DbExecutor } from '../db/client';
import { assetPacks, users } from '../db/schema';
import type { FileStorage } from '../storage/storage';

/** Owner key for the admin's changes to the default pack. User ids are UUIDs, so no clash. */
export const DEFAULT_PACK_OWNER = 'default';

export type PackUploadError = 'FILE_TOO_LARGE' | 'WRONG_SIZE' | 'NOT_AN_IMAGE' | 'NOT_A_FONT';

export type PackUploadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: PackUploadError; readonly expected?: string };

/** The parts an owner has replaced: part → storage key. */
export function getPackFiles(db: DbExecutor, owner: string): Partial<Record<PackPart, string>> {
  const row = db
    .select({ files: assetPacks.files })
    .from(assetPacks)
    .where(eq(assetPacks.owner, owner))
    .get();
  return row?.files ?? {};
}

/** The pack used to draw a player's cards (or, for DEFAULT_PACK_OWNER, the default pack). */
export function getAssetPack(db: DbExecutor, owner: string): AssetPack {
  const base = getPackFiles(db, DEFAULT_PACK_OWNER);
  const own = owner === DEFAULT_PACK_OWNER ? {} : getPackFiles(db, owner);
  const files = { ...base, ...own };

  const images = { ...DEFAULT_ASSET_PACK.images };
  for (const { part } of IMAGE_PARTS) {
    const key = files[part];
    if (key) images[part] = mediaUrl(key);
  }
  const fontKey = files.font;
  return {
    id: owner,
    name: owner === DEFAULT_PACK_OWNER ? DEFAULT_ASSET_PACK.name : 'Custom pack',
    images,
    // The family name is derived from the file, so two different fonts never share a name.
    font: fontKey ? { family: `pack-${hash(fontKey)}`, url: mediaUrl(fontKey) } : null,
  };
}

/** Validates and stores one part, replacing (and deleting) the previous upload. */
export async function uploadPackPart(
  db: AppDatabase,
  storage: FileStorage,
  owner: string,
  part: PackPart,
  data: Buffer,
): Promise<PackUploadResult> {
  const prepared = part === 'font' ? prepareFont(data) : await prepareImage(part, data);
  if (!prepared.ok) return prepared;

  const key = `packs/${owner}/${PART_FILE_NAMES[part]}-${hash(prepared.data)}.${prepared.extension}`;
  await storage.put(key, prepared.data, prepared.contentType);
  const previous = setPart(db, owner, part, key);
  if (previous && previous !== key) await storage.delete(previous);
  return { ok: true };
}

/** Goes back to the default for one part. */
export async function resetPackPart(
  db: AppDatabase,
  storage: FileStorage,
  owner: string,
  part: PackPart,
): Promise<void> {
  const previous = setPart(db, owner, part, null);
  if (previous) await storage.delete(previous);
}

/** Removes every replaced part (moderation). */
export async function resetPack(
  db: AppDatabase,
  storage: FileStorage,
  owner: string,
): Promise<void> {
  db.delete(assetPacks).where(eq(assetPacks.owner, owner)).run();
  await storage.deleteFolder(`packs/${owner}`);
}

/** Players who have replaced at least one part, for moderation. */
export function listCustomPacks(
  db: AppDatabase,
): { userId: string; username: string; parts: number }[] {
  return db
    .select({ owner: assetPacks.owner, files: assetPacks.files, username: users.username })
    .from(assetPacks)
    .innerJoin(users, eq(assetPacks.owner, users.id))
    .where(ne(assetPacks.owner, DEFAULT_PACK_OWNER))
    .all()
    .map((row) => ({
      userId: row.owner,
      username: row.username,
      parts: Object.keys(row.files).length,
    }))
    .filter((row) => row.parts > 0)
    .sort((a, b) => a.username.localeCompare(b.username));
}

/** Sets or clears a part; returns the storage key it replaced. */
function setPart(
  db: AppDatabase,
  owner: string,
  part: PackPart,
  key: string | null,
): string | null {
  return db.transaction((tx) => {
    const current = getPackFiles(tx, owner);
    const previous = current[part] ?? null;
    const files: Record<string, string> = {};
    for (const [name, value] of Object.entries(current)) {
      if (name !== part) files[name] = value;
    }
    if (key) files[part] = key;
    tx.insert(assetPacks)
      .values({ owner, files, updatedAt: new Date() })
      .onConflictDoUpdate({ target: assetPacks.owner, set: { files, updatedAt: new Date() } })
      .run();
    return previous;
  });
}

type Prepared =
  | { ok: true; data: Buffer; extension: string; contentType: string }
  | { ok: false; error: PackUploadError; expected?: string };

/** Images must be PNG or WebP at the exact size; they are re-encoded as PNG (stripping metadata). */
async function prepareImage(part: ImagePart, data: Buffer): Promise<Prepared> {
  if (data.byteLength > PACK_IMAGE_MAX_BYTES) return { ok: false, error: 'FILE_TOO_LARGE' };
  const spec = IMAGE_PARTS.find((candidate) => candidate.part === part);
  if (!spec) return { ok: false, error: 'NOT_AN_IMAGE' };

  let metadata: Metadata;
  try {
    metadata = await sharp(data, { limitInputPixels: 10_000_000 }).metadata();
  } catch {
    return { ok: false, error: 'NOT_AN_IMAGE' };
  }
  if (metadata.format !== 'png' && metadata.format !== 'webp') {
    return { ok: false, error: 'NOT_AN_IMAGE' };
  }
  if (metadata.width !== spec.width || metadata.height !== spec.height) {
    return {
      ok: false,
      error: 'WRONG_SIZE',
      expected: `${String(spec.width)} × ${String(spec.height)}`,
    };
  }
  const png = await sharp(data).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
  return { ok: true, data: png, extension: 'png', contentType: 'image/png' };
}

/** Fonts are recognised by their signature, not their file name. */
function prepareFont(data: Buffer): Prepared {
  if (data.byteLength > PACK_FONT_MAX_BYTES) return { ok: false, error: 'FILE_TOO_LARGE' };
  const signature = data.subarray(0, 4);
  const formats: readonly [Buffer, string, string][] = [
    [Buffer.from([0x00, 0x01, 0x00, 0x00]), 'ttf', 'font/ttf'],
    [Buffer.from('true', 'latin1'), 'ttf', 'font/ttf'],
    [Buffer.from('OTTO', 'latin1'), 'otf', 'font/otf'],
    [Buffer.from('wOF2', 'latin1'), 'woff2', 'font/woff2'],
  ];
  const match = formats.find(([magic]) => signature.equals(magic));
  if (!match) return { ok: false, error: 'NOT_A_FONT' };
  return { ok: true, data, extension: match[1], contentType: match[2] };
}

function hash(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function mediaUrl(key: string): string {
  return `/media/${key}`;
}
