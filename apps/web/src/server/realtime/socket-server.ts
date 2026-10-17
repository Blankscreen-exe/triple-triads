/**
 * Real-time channel (Socket.IO) sharing the HTTP server and port with Next.js.
 *
 * Responsibilities: authenticate each connection from the session cookie, validate every incoming
 * message, forward it to the room manager, and deliver personalised snapshots. Game rules live in
 * the room manager and the engine, not here.
 */
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { z } from 'zod';
import {
  createRoomSchema,
  joinRoomSchema,
  moveSchema,
  roomIdSchema,
  voteSchema,
  type Ack,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@/lib/realtime/protocol';
import { readCookie, SESSION_COOKIE } from '../auth/session-cookie-name';
import { validateSessionToken, type SessionUser } from '../auth/sessions';
import type { AppDatabase } from '../db/client';
import type { Logger } from '../logger';
import { createDatabaseDeckProvider } from '../rooms/game-decks';
import { recordMatch } from '../matches/matches';
import { RoomManager } from '../rooms/room-manager';
import { getAssetPack } from '../packs/asset-packs';
import { getGameSettings } from '../settings/settings';

export const SOCKET_PATH = '/socket.io';
const LOBBY_CHANNEL = 'lobby';

interface SocketData {
  user: SessionUser;
  /** Kept to re-check the session before every command (logout and bans apply at once). */
  sessionToken: string;
}

type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export interface SocketServerOptions {
  readonly db: AppDatabase;
  readonly logger: Logger;
}

export interface RealtimeServer {
  readonly io: GameServer;
  readonly rooms: RoomManager;
  close(): Promise<void>;
}

export function createSocketServer(
  httpServer: HttpServer,
  { db, logger }: SocketServerOptions,
): RealtimeServer {
  const io: GameServer = new Server(httpServer, {
    path: SOCKET_PATH,
    serveClient: false,
    // Next.js handles its own WebSocket upgrades (hot reload in development) on the same server.
    // By default Socket.IO destroys upgrade requests for other paths, which would break them.
    destroyUpgrade: false,
  });

  /** roomId → userId → that user's sockets in the room (a user may have several tabs open). */
  const presence = new Map<string, Map<string, Set<GameSocket>>>();

  const rooms: RoomManager = new RoomManager({
    decks: createDatabaseDeckProvider(db),
    roomPolicy: () => getGameSettings(db).roomPolicy,
    packFor: (userId) => getAssetPack(db, userId),
    onGameFinished: (game) => {
      logger.info(
        { roomId: game.roomId, result: game.result, forfeit: game.forfeit },
        'game finished',
      );
      try {
        return recordMatch(db, game);
      } catch (error) {
        // A recording failure must not break the game for the players; it is logged instead.
        logger.error({ err: error, roomId: game.roomId }, 'failed to record a finished game');
        return undefined;
      }
    },
    events: {
      roomChanged: (roomId) => {
        const users = presence.get(roomId);
        if (!users) return;
        for (const userId of rooms.participants(roomId)) {
          const snapshot = rooms.snapshot(roomId, userId);
          if (!snapshot) continue;
          for (const socket of users.get(userId) ?? []) socket.emit('room:state', snapshot);
        }
      },
      roomClosed: (roomId) => {
        for (const sockets of presence.get(roomId)?.values() ?? []) {
          for (const socket of sockets) socket.emit('room:closed', { roomId });
        }
        presence.delete(roomId);
      },
      lobbyChanged: () => {
        io.to(LOBBY_CHANNEL).emit('lobby:rooms', rooms.listRooms());
      },
    },
  });

  const addPresence = (roomId: string, socket: GameSocket) => {
    const users = presence.get(roomId) ?? new Map<string, Set<GameSocket>>();
    presence.set(roomId, users);
    const sockets = users.get(socket.data.user.id) ?? new Set<GameSocket>();
    users.set(socket.data.user.id, sockets);
    sockets.add(socket);
  };

  /** Removes the socket; returns true if it was the user's last connection to the room. */
  const removePresence = (roomId: string, socket: GameSocket): boolean => {
    const users = presence.get(roomId);
    const sockets = users?.get(socket.data.user.id);
    if (!users || !sockets) return false;
    sockets.delete(socket);
    if (sockets.size > 0) return false;
    users.delete(socket.data.user.id);
    return true;
  };

  io.use((socket, next) => {
    const token = readCookie(socket.request.headers.cookie, SESSION_COOKIE);
    const user = token === null ? null : validateSessionToken(db, token);
    if (token === null || user === null) {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    socket.data.user = user;
    socket.data.sessionToken = token;
    next();
  });

  io.on('connection', (socket: GameSocket) => {
    const { user } = socket.data;
    const roomUser = { id: user.id, username: user.username };
    logger.debug({ socketId: socket.id, userId: user.id }, 'socket connected');

    socket.on('lobby:subscribe', () => {
      void socket.join(LOBBY_CHANNEL);
      socket.emit('lobby:rooms', rooms.listRooms());
    });

    socket.on('lobby:unsubscribe', () => {
      void socket.leave(LOBBY_CHANNEL);
    });

    socket.on('room:create', (input, ack) => {
      handle(socket, createRoomSchema, input, ack, (data) => {
        const result = rooms.createRoom(roomUser, data);
        if (result.ok) addPresence(result.data.roomId, socket);
        return result;
      });
    });

    socket.on('room:join', (input, ack) => {
      handle(socket, joinRoomSchema, input, ack, (data) => {
        // Register first so the snapshot sent for this change reaches this socket.
        addPresence(data.roomId, socket);
        const result = rooms.joinRoom(roomUser, data);
        if (!result.ok) {
          removePresence(data.roomId, socket);
          return result;
        }
        // Always give the joining connection the current state, even when the join changed
        // nothing (e.g. a spectator re-opening the room page).
        const snapshot = rooms.snapshot(data.roomId, user.id);
        if (snapshot) socket.emit('room:state', snapshot);
        return result;
      });
    });

    socket.on('room:leave', (input, ack) => {
      handle(socket, roomIdSchema, input, ack, ({ roomId }) => {
        const result = rooms.leaveRoom(user.id, roomId);
        for (const other of presence.get(roomId)?.get(user.id) ?? []) {
          other.emit('room:closed', { roomId });
        }
        presence.get(roomId)?.delete(user.id);
        return result;
      });
    });

    socket.on('game:move', (input, ack) => {
      handle(socket, moveSchema, input, ack, (data) => rooms.playMove(user.id, data));
    });

    socket.on('game:vote', (input, ack) => {
      handle(socket, voteSchema, input, ack, ({ roomId, choice }) =>
        rooms.vote(user.id, roomId, choice),
      );
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, userId: user.id, reason }, 'socket disconnected');
      for (const roomId of [...presence.keys()]) {
        if (removePresence(roomId, socket)) rooms.disconnected(user.id, roomId);
      }
    });
  });

  /** Validates the payload, runs the command and always answers the client. */
  /**
   * Re-checks the session, validates the payload, runs the command and always answers the
   * client. A session that ended (logout, ban, password reset) disconnects the socket.
   */
  function handle<Schema extends z.ZodType, T>(
    socket: GameSocket,
    schema: Schema,
    input: unknown,
    ack: unknown,
    run: (data: z.infer<Schema>) => Ack<T>,
  ): void {
    const reply = typeof ack === 'function' ? (ack as (result: Ack<T>) => void) : () => undefined;
    if (!validateSessionToken(db, socket.data.sessionToken)) {
      reply({ ok: false, error: 'UNAUTHENTICATED' });
      socket.disconnect(true);
      return;
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      reply({ ok: false, error: 'INVALID_INPUT' });
      return;
    }
    try {
      reply(run(parsed.data));
    } catch (error) {
      logger.error({ err: error }, 'socket command failed');
      reply({ ok: false, error: 'SERVER_ERROR' });
    }
  }

  return {
    io,
    rooms,
    close: () =>
      new Promise((resolve, reject) => {
        rooms.dispose();
        void io.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
