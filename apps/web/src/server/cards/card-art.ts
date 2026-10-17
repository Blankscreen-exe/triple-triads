/**
 * Turning an uploaded image into card art: validated, fitted onto the card canvas without
 * cropping (transparent margins keep cut-out art intact) and stored as WebP in two sizes.
 */
import { createHash } from 'node:crypto';
import { CARD_LAYOUT, type CardLayout } from '@triple-triad/card-layout';
import sharp, { type Metadata } from 'sharp';
import { CARD_ART_MAX_BYTES, CARD_ART_MIN_SIDE } from '@/lib/validation/card';
import type { FileStorage } from '../storage/storage';

export type CardArtError = 'IMAGE_TOO_LARGE' | 'IMAGE_TOO_SMALL' | 'UNSUPPORTED_IMAGE';

export interface ProcessedArt {
  /** Full card size (1024 × 1434). */
  readonly full: Buffer;
  /** Half size, used wherever cards are shown in the UI. */
  readonly card: Buffer;
  /** Content hash, used in file names so updated art never hits a stale cache. */
  readonly hash: string;
}

const ACCEPTED_FORMATS = new Set(['png', 'webp', 'jpeg']);
/** Refuse decompression bombs: images are never allowed to expand beyond this many pixels. */
const MAX_INPUT_PIXELS = 40_000_000;

export async function processCardArt(
  input: Buffer,
  layout: CardLayout = CARD_LAYOUT,
): Promise<{ ok: true; art: ProcessedArt } | { ok: false; error: CardArtError }> {
  if (input.byteLength > CARD_ART_MAX_BYTES) return { ok: false, error: 'IMAGE_TOO_LARGE' };

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return { ok: false, error: 'UNSUPPORTED_IMAGE' };
  }
  if (!ACCEPTED_FORMATS.has(metadata.format)) return { ok: false, error: 'UNSUPPORTED_IMAGE' };
  if (Math.min(metadata.width, metadata.height) < CARD_ART_MIN_SIDE) {
    return { ok: false, error: 'IMAGE_TOO_SMALL' };
  }

  const render = (width: number, height: number) =>
    sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // honour EXIF orientation from phone photos
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 88, alphaQuality: 90 })
      .toBuffer();

  const full = await render(layout.width, layout.height);
  const card = await render(Math.round(layout.width / 2), Math.round(layout.height / 2));
  const hash = createHash('sha256').update(full).digest('hex').slice(0, 16);
  return { ok: true, art: { full, card, hash } };
}

const ART_SIZES = ['full', 'card'] as const;

/**
 * Processes and stores art for a card. Returns the art key ("cards/<id>/<hash>") to save on the
 * card row; the files are `<key>-full.webp` and `<key>-card.webp`.
 */
export async function storeCardArt(
  storage: FileStorage,
  cardId: string,
  input: Buffer,
): Promise<{ ok: true; artKey: string } | { ok: false; error: CardArtError }> {
  const processed = await processCardArt(input);
  if (!processed.ok) return processed;
  const artKey = `cards/${cardId}/${processed.art.hash}`;
  await storage.put(`${artKey}-full.webp`, processed.art.full, 'image/webp');
  await storage.put(`${artKey}-card.webp`, processed.art.card, 'image/webp');
  return { ok: true, artKey };
}

/** Deletes one version of a card's art. */
export async function deleteCardArt(storage: FileStorage, artKey: string): Promise<void> {
  await Promise.all(ART_SIZES.map((size) => storage.delete(`${artKey}-${size}.webp`)));
}
