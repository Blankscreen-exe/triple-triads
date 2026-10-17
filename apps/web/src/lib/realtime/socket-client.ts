'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/**
 * The browser's single connection to the game server, shared by every page so client-side
 * navigation (lobby → room) keeps the same connection. The session cookie authenticates it.
 */
export function getSocket(): GameSocket {
  socket ??= io({ path: '/socket.io', transports: ['websocket', 'polling'] });
  return socket;
}
