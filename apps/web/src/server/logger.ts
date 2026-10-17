import { pino, type Logger } from 'pino';
import type { ServerConfig } from './config';

export type { Logger };

/** Structured JSON logs in production; human-readable output in development. */
export function createLogger(config: Pick<ServerConfig, 'isDev' | 'logLevel'>): Logger {
  return pino({
    level: config.logLevel,
    ...(config.isDev && {
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
    }),
  });
}
