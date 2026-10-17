import { getStorage } from '@/server/storage';

/**
 * Serves uploaded files. File names contain a content hash, so responses can be cached forever.
 */
export async function GET(_request: Request, { params }: RouteContext<'/media/[...path]'>) {
  const { path } = await params;
  const file = await getStorage().get(path.join('/'));
  if (!file) return new Response('Not found', { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
