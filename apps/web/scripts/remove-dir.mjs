/** Cross-platform `rm -rf <dir>`, used by test scripts. */
import { rmSync } from 'node:fs';

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node scripts/remove-dir.mjs <dir>');
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });
