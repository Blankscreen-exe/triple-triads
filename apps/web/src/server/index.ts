/**
 * Application entry point: one HTTP server on one port serving the Next.js app, the Socket.IO
 * real-time channel and a health check.
 *
 * Run from the `apps/web` directory (the package scripts do this).
 */
import { existsSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import next from 'next';
import { ConfigError, loadConfig } from './config';
import { closeDatabase } from './db/client';
import { prepareDatabase, scheduleSessionCleanup } from './db/startup';
import { createLogger } from './logger';
import { createSocketServer } from './realtime/socket-server';

const HEALTH_PATH = '/healthz';
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');

  const config = loadConfig(process.env);
  const logger = createLogger(config);

  // Migrate before Next.js starts: its server code assumes an up-to-date schema.
  const db = prepareDatabase(config.databasePath, logger);
  const stopSessionCleanup = scheduleSessionCleanup(db, logger);

  const httpServer = createServer();
  const app = next({
    dev: config.isDev,
    dir: process.cwd(),
    hostname: config.host,
    port: config.port,
    httpServer,
  });
  const handleNextRequest = app.getRequestHandler();
  await app.prepare();

  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    const startedAt = performance.now();
    res.on('finish', () => {
      logger.debug(
        {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          ms: Math.round(performance.now() - startedAt),
        },
        'request',
      );
    });

    if (req.method === 'GET' && req.url === HEALTH_PATH) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    handleNextRequest(req, res).catch((error: unknown) => {
      logger.error({ err: error, url: req.url }, 'unhandled request error');
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });

  const realtime = createSocketServer(httpServer, { db, logger });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.port, config.host, resolve);
  });
  logger.info(`Server ready on http://${config.host}:${String(config.port)} (${config.env})`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    stopSessionCleanup();
    // Closing Socket.IO also closes the underlying HTTP server.
    realtime
      .close()
      .then(() => app.close())
      .then(() => {
        closeDatabase(db);
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, 'error while shutting down');
        process.exit(1);
      });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  // The logger may not exist yet (e.g. invalid configuration), so report plainly.
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
