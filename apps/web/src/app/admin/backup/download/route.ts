import { createBackup } from '@/server/backup/backup';
import { getDatabase } from '@/server/db';
import { getStorage } from '@/server/storage';
import { getCurrentUser } from '@/server/web/current-user';

/** Downloads a backup of the whole server (admins only; others get a 404 like the admin pages). */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return new Response(null, { status: 404 });

  const now = new Date();
  const archive = await createBackup(getDatabase(), getStorage(), { now: () => now });
  // e.g. triple-triad-backup-2026-10-19-1030.zip
  const stamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  return new Response(archive, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="triple-triad-backup-${stamp}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
