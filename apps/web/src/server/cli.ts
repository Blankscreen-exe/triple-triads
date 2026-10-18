/**
 * Command-line tools for server data, using the same settings as the server (environment
 * variables, or apps/web/.env):
 *
 *   node dist/cli.mjs export [file]         write a backup (default: a dated file here)
 *   node dist/cli.mjs import <file> --yes   replace all data with a backup
 *
 * Also available as `pnpm data:export` and `pnpm data:import`.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createBackup, restoreBackup, type RestoreError } from './backup/backup';
import { ConfigError, loadConfig } from './config';
import { closeDatabase, migrateDatabase, openDatabase } from './db/client';
import { createStorage } from './storage';

const USAGE = `Usage:
  export [file]         Write a backup of all server data (default: triple-triad-backup-<date>.zip)
  import <file> --yes   Replace ALL server data with a backup (everyone logs in again)`;

const RESTORE_ERRORS: Record<RestoreError, string> = {
  NOT_A_BACKUP: 'not a Triple Triad backup',
  NEWER_VERSION: 'made by a newer version of Triple Triad; update this server first',
  CORRUPT_DATABASE: 'the backup is damaged',
  TOO_LARGE: 'the backup is too large',
};

async function main(args: readonly string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command !== 'export' && command !== 'import') {
    console.error(USAGE);
    return 2;
  }

  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = loadConfig(process.env);
  const db = openDatabase(config.databasePath);
  try {
    // Bring the database up to date first, exactly as the server does on startup.
    migrateDatabase(db);
    const storage = createStorage(config.storage);

    if (command === 'export') {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
      const file = resolve(rest[0] ?? `triple-triad-backup-${stamp}.zip`);
      const archive = await createBackup(db, storage);
      await writeFile(file, archive);
      console.log(`Backup written to ${file} (${formatSize(archive.byteLength)}).`);
      return 0;
    }

    const file = rest.find((arg) => !arg.startsWith('--'));
    if (!file) {
      console.error(USAGE);
      return 2;
    }
    if (!rest.includes('--yes')) {
      console.error(
        `This replaces ALL data on this server (database at ${config.databasePath}) with the ` +
          'backup. Run again with --yes to continue.',
      );
      return 1;
    }
    const result = await restoreBackup(db, storage, await readFile(resolve(file)));
    if (!result.ok) {
      console.error(`Restore refused: ${RESTORE_ERRORS[result.error]}.`);
      if (result.detail) console.error(result.detail);
      return 1;
    }
    const { counts, createdAt } = result.manifest;
    console.log(
      `Restored the backup from ${createdAt}: ${String(counts.users)} players, ` +
        `${String(counts.cards)} cards, ${String(counts.decks)} decks, ` +
        `${String(counts.matches)} matches, ${String(counts.files)} files.`,
    );
    console.log('If the server is running, restart it so that games in progress end.');
    return 0;
  } finally {
    closeDatabase(db);
  }
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${String(Math.ceil(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof ConfigError ? error.message : error);
    process.exitCode = 1;
  },
);
