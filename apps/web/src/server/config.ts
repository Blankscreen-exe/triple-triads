/**
 * Server configuration, read once from environment variables and validated at startup so a
 * misconfigured deployment fails immediately with a clear message instead of misbehaving later.
 */
import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Interface to bind to. Use 0.0.0.0 inside containers; keep 127.0.0.1 behind a local tunnel. */
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
});

export interface ServerConfig {
  readonly env: 'development' | 'production' | 'test';
  readonly isDev: boolean;
  readonly host: string;
  readonly port: number;
  readonly logLevel: (typeof LOG_LEVELS)[number];
}

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

  const { NODE_ENV, HOST, PORT, LOG_LEVEL } = parsed.data;
  return {
    env: NODE_ENV,
    isDev: NODE_ENV === 'development',
    host: HOST,
    port: PORT,
    logLevel: LOG_LEVEL,
  };
}
