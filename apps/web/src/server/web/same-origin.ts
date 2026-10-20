/**
 * Server actions reject requests from other sites; route handlers do not. A route handler that
 * changes data calls this first, comparing the browser's Origin header with the host the request
 * was made to (the forwarded host behind a proxy or tunnel), or with the configured
 * `allowedOrigins` for proxies and tunnels that forward their own host instead.
 */
export function isSameOrigin(request: Request, allowedOrigins: readonly string[] = []): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? request.headers.get('host');
  return originHost === host || allowedOrigins.some((pattern) => hostMatches(originHost, pattern));
}

/**
 * Whether `host` fits `pattern`, matched the way Next.js matches `allowedOrigins`: `*` stands for
 * exactly one label, a leading `**` for one or more, and a host with a port matches no pattern
 * without one.
 */
export function hostMatches(host: string, pattern: string): boolean {
  const hostLabels = host.toLowerCase().split('.');
  const labels = pattern.split('.');
  const deep = labels[0] === '**';
  if (deep) labels.shift();
  const fits = deep ? hostLabels.length > labels.length : hostLabels.length === labels.length;
  if (!fits) return false;
  const tail = hostLabels.slice(hostLabels.length - labels.length);
  return labels.every((label, index) => label === '*' || label === tail[index]);
}
