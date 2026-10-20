import type { NextConfig } from 'next';

/**
 * Public hostnames the app is also reached at, such as a tunnel's (`*.trycloudflare.com`).
 * src/server/config.ts validates ALLOWED_ORIGINS when the server starts; it is read here directly
 * because the Docker image ships this file without the app's source.
 */
const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? '')
  .split(',')
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry !== '');

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The dev server refuses its scripts and hot reload to other hosts, which leaves pages dead.
  allowedDevOrigins: allowedOrigins,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Card art uploads go through server actions: 5 MB of art plus multipart overhead.
      bodySizeLimit: '6mb',
      // Actions are refused when the page's host differs from the host the server sees.
      allowedOrigins,
    },
  },
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@triple-triad/card-layout', '@triple-triad/engine'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
