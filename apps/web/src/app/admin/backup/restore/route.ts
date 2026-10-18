import {
  MAX_BACKUP_BYTES,
  restoreBackup,
  type BackupManifest,
  type RestoreError,
} from '@/server/backup/backup';
import { getDatabase } from '@/server/db';
import { getRealtime } from '@/server/realtime/registry';
import { getStorage } from '@/server/storage';
import { getCurrentUser } from '@/server/web/current-user';
import { isSameOrigin } from '@/server/web/same-origin';
import { clearSessionCookie } from '@/server/web/session-cookie';

export type RestoreResponse =
  | { readonly ok: true; readonly manifest: BackupManifest }
  | { readonly ok: false; readonly error: string };

const MESSAGES: Record<RestoreError, string> = {
  NOT_A_BACKUP: 'That file is not a Triple Triad backup.',
  NEWER_VERSION:
    'That backup was made by a newer version of Triple Triad. Update this server and try again.',
  CORRUPT_DATABASE: 'That backup is damaged and cannot be restored.',
  TOO_LARGE: 'That backup is too large.',
};

const reply = (body: RestoreResponse, status = 200) => Response.json(body, { status });

/**
 * Replaces all server data with an uploaded backup (the request body is the archive itself).
 * Admins only; afterwards everyone, including the admin, logs in again.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return new Response(null, { status: 404 });
  if (!isSameOrigin(request)) return reply({ ok: false, error: 'Request refused.' }, 403);

  const declaredSize = Number(request.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_BACKUP_BYTES) {
    return reply({ ok: false, error: MESSAGES.TOO_LARGE }, 413);
  }
  const archive = new Uint8Array(await request.arrayBuffer());

  const result = await restoreBackup(getDatabase(), getStorage(), archive, {
    beforeReplace: () => {
      getRealtime()?.closeAllRooms('The server’s data was restored from a backup.');
    },
  });
  if (!result.ok) return reply({ ok: false, error: MESSAGES[result.error] }, 400);

  // The admin's session no longer exists either; drop the stale cookie.
  await clearSessionCookie();
  return reply({ ok: true, manifest: result.manifest });
}
