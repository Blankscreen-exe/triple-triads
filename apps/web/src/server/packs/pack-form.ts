/**
 * Shared handling for pack upload server actions (player and admin).
 */
import { isPackPart } from '@/lib/asset-pack-spec';
import type { AppDatabase } from '../db/client';
import type { FileStorage } from '../storage/storage';
import { resetPackPart, uploadPackPart, type PackUploadError } from './asset-packs';

export type PackFormResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

const MESSAGES: Record<PackUploadError, string> = {
  FILE_TOO_LARGE: 'That file is too large.',
  WRONG_SIZE: 'That image is the wrong size.',
  NOT_AN_IMAGE: 'That file is not a PNG or WebP image.',
  NOT_A_FONT: 'That file is not a TTF, OTF or WOFF2 font.',
};

export async function handlePackUpload(
  db: AppDatabase,
  storage: FileStorage,
  owner: string,
  formData: FormData,
): Promise<PackFormResult> {
  const part = formData.get('part');
  const file = formData.get('file');
  if (!isPackPart(part) || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file to upload.' };
  }
  const result = await uploadPackPart(
    db,
    storage,
    owner,
    part,
    Buffer.from(await file.arrayBuffer()),
  );
  if (result.ok) return result;
  return {
    ok: false,
    error:
      result.error === 'WRONG_SIZE' && result.expected
        ? `That image is the wrong size: it must be exactly ${result.expected}.`
        : MESSAGES[result.error],
  };
}

export async function handlePackReset(
  db: AppDatabase,
  storage: FileStorage,
  owner: string,
  part: unknown,
): Promise<PackFormResult> {
  if (!isPackPart(part)) return { ok: false, error: 'Invalid request.' };
  await resetPackPart(db, storage, owner, part);
  return { ok: true };
}
