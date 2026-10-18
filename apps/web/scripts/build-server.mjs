/**
 * Bundles the custom server (src/server) into dist/server.mjs, and the data tools into
 * dist/cli.mjs, for production.
 *
 * Third-party packages stay external and load from node_modules at runtime. Workspace packages
 * (@triple-triad/*) ship TypeScript source, and `@/` is this app's own source, so both are bundled.
 */
import { build } from 'esbuild';

const WORKSPACE_SCOPE = '@triple-triad/';
/** tsconfig path alias for apps/web/src; resolved by esbuild from tsconfig.json. */
const SOURCE_ALIAS = '@/';

/** @type {import('esbuild').Plugin} */
const externalizeThirdParty = {
  name: 'externalize-third-party',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) =>
      args.path.startsWith(WORKSPACE_SCOPE) || args.path.startsWith(SOURCE_ALIAS)
        ? undefined
        : { path: args.path, external: true },
    );
  },
};

await build({
  // The server, and the command-line tools for server data (see src/server/cli.ts).
  entryPoints: { server: 'src/server/index.ts', cli: 'src/server/cli.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  plugins: [externalizeThirdParty],
  logLevel: 'info',
});
