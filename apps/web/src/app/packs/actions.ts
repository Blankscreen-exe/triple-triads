'use server';

import { refresh } from 'next/cache';
import { getDatabase } from '@/server/db';
import { handlePackReset, handlePackUpload, type PackFormResult } from '@/server/packs/pack-form';
import { getStorage } from '@/server/storage';
import { requireUser } from '@/server/web/current-user';

/** Uploads a part of the signed-in player's own pack (never anyone else's). */
export async function uploadMyPackPart(formData: FormData): Promise<PackFormResult> {
  const user = await requireUser();
  const result = await handlePackUpload(getDatabase(), getStorage(), user.id, formData);
  if (result.ok) refresh();
  return result;
}

export async function resetMyPackPart(part: unknown): Promise<PackFormResult> {
  const user = await requireUser();
  const result = await handlePackReset(getDatabase(), getStorage(), user.id, part);
  if (result.ok) refresh();
  return result;
}
