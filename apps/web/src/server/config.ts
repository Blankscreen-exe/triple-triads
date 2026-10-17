/**
 * Server configuration, read once from environment variables and validated at startup so a
 * misconfigured deployment fails immediately with a clear message instead of misbehaving later.
 */
import { resolve } from 'node:path';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Interface to bind to. Use 0.0.0.0 inside containers; keep 127.0.0.1 behind a local tunnel. */
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  /** Directory for the database and uploaded files. Relative paths resolve from the app directory. */
  DATA_DIR: z.string().min(1).default('./data'),
});

export interface ServerConfig {
  readonly env: 'development' | 'production' | 'test';
  readonly isDev: boolean;
  readonly host: string;
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
  /** Absolute path of the data directory. */
  readonly dataDir: string;
  /** Absolute path of the SQLite database file. */
  readonly databasePath: string;
}

const DATABASE_FILE = 'triple-triad.db';

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): ServerConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new ConfigError(`Invalid environment configuration:\n${problems.join('\n')}`);
  }

  const { NODE_ENV, HOST, PORT, LOG_LEVEL, DATA_DIR } = parsed.data;
  const dataDir = resolve(DATA_DIR);
  return {
    env: NODE_ENV,
    isDev: NODE_ENV === 'development',
    host: HOST,
    port: PORT,
    logLevel: LOG_LEVEL,
    dataDir,
    databasePath: resolve(dataDir, DATABASE_FILE),
  };
}
