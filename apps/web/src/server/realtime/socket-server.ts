/**
 * Real-time channel (Socket.IO) sharing the HTTP server and port with Next.js.
 */
import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Logger } from '../logger';

export const SOCKET_PATH = '/socket.io';

export function createSocketServer(httpServer: HttpServer, logger: Logger): Server {
  const io = new Server(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    // Next.js handles its own WebSocket upgrades (hot reload in development) on the same server.
    // By default Socket.IO destroys upgrade requests for other paths, which would break them.
    destroyUpgrade: false,
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'socket connected');
    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected');
    });
  });

  return io;
}
