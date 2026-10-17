import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // Card art uploads go through server actions: 5 MB of art plus multipart overhead.
      bodySizeLimit: '6mb',
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
