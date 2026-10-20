/**
 * Server configuration, read once from environment variables and validated at startup so a
 * misconfigured deployment fails immediately with a clear message instead of misbehaving later.
 */
import { resolve } from 'node:path';
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

/** One label of a hostname, or `*` for any one label. */
const LABEL = '(?:\\*|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)';
/** A hostname without scheme or port; a leading `**.` stands for one or more labels. */
const HOST_PATTERN = new RegExp(`^(?:\\*\\*\\.)?${LABEL}(?:\\.${LABEL})*$`);

const hostPatterns = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== ''),
  )
  .pipe(
    z.array(
      z
        .string()
        .regex(
          HOST_PATTERN,
          'Expected a hostname such as play.example.com or *.trycloudflare.com, without https:// or a port.',
        )
        .refine((pattern) => /[a-z0-9]/.test(pattern), 'A wildcard alone would allow every site.'),
    ),
  );

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    /** Interface to bind to. Use 0.0.0.0 inside containers; keep 127.0.0.1 behind a local tunnel. */
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    /** Directory for the database (and uploads, with local storage). Relative to the app directory. */
    DATA_DIR: z.string().min(1).default('./data'),
    /** Session cookies are HTTPS-only. Defaults to on in production. */
    SECURE_COOKIES: booleanFlag.optional(),
    /**
     * Comma-separated public hostnames the app is also reached at, such as a tunnel's, when they do
     * not reach the server as its host. next.config.ts reads the same variable.
     */
    ALLOWED_ORIGINS: hostPatterns,
    STORAGE_DRIVER: z.enum(['local', 'minio']).default('local'),
    MINIO_ENDPOINT: z.string().min(1).optional(),
    MINIO_PORT: z.coerce.number().int().min(1).max(65_535).default(9000),
    MINIO_USE_SSL: booleanFlag.default(false),
    MINIO_ACCESS_KEY: z.string().min(1).optional(),
    MINIO_SECRET_KEY: z.string().min(1).optional(),
    MINIO_BUCKET: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, 'Not a valid bucket name.')
      .default('triple-triad'),
  })
  .superRefine((env, context) => {
    if (env.STORAGE_DRIVER !== 'minio') return;
    for (const key of ['MINIO_ENDPOINT', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'] as const) {
      if (!env[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required when STORAGE_DRIVER=minio.',
        });
      }
    }
  });

export type StorageConfig =
  | { readonly driver: 'local'; readonly dir: string }
  | {
      readonly driver: 'minio';
      readonly endPoint: string;
      readonly port: number;
      readonly useSSL: boolean;
      readonly accessKey: string;
      readonly secretKey: string;
      readonly bucket: string;
    };

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
  readonly secureCookies: boolean;
  /** Hostname patterns of other sites allowed to send requests that change data. */
  readonly allowedOrigins: readonly string[];
  readonly storage: StorageConfig;
}

const DATABASE_FILE = 'triple-triad.db';
const UPLOADS_DIR = 'uploads';

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

  const values = parsed.data;
  const dataDir = resolve(values.DATA_DIR);
  return {
    env: values.NODE_ENV,
    isDev: values.NODE_ENV === 'development',
    host: values.HOST,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    dataDir,
    databasePath: resolve(dataDir, DATABASE_FILE),
    secureCookies: values.SECURE_COOKIES ?? values.NODE_ENV === 'production',
    allowedOrigins: values.ALLOWED_ORIGINS,
    storage:
      values.STORAGE_DRIVER === 'minio'
        ? {
            driver: 'minio',
            endPoint: values.MINIO_ENDPOINT ?? '',
            port: values.MINIO_PORT,
            useSSL: values.MINIO_USE_SSL,
            accessKey: values.MINIO_ACCESS_KEY ?? '',
            secretKey: values.MINIO_SECRET_KEY ?? '',
            bucket: values.MINIO_BUCKET,
          }
        : { driver: 'local', dir: resolve(dataDir, UPLOADS_DIR) },
  };
}
