/**
 * Bundles the custom server (src/server) into dist/server.mjs for production.
 *
 * Third-party packages stay external and load from node_modules at runtime. Workspace packages
 * (@triple-triad/*) ship TypeScript source, so they are bundled in.
 */
import { build } from 'esbuild';

const WORKSPACE_SCOPE = '@triple-triad/';

/** @type {import('esbuild').Plugin} */
const externalizeThirdParty = {
  name: 'externalize-third-party',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith(WORKSPACE_SCOPE) ? undefined : { path: args.path, external: true },
    );
  },
};

await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  plugins: [externalizeThirdParty],
  logLevel: 'info',
});
