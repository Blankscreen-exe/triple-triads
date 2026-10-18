/**
 * Server actions reject requests from other sites; route handlers do not. A route handler that
 * changes data calls this first, comparing the browser's Origin header with the host the request
 * was made to (the forwarded host behind a proxy or tunnel).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
