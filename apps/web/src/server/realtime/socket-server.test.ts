import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { BASIC_RULES } from '@triple-triad/engine';
import { pino } from 'pino';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  ClientToServerEvents,
  CreateRoomInput,
  RoomSnapshot,
  RoomSummary,
  ServerToClientEvents,
} from '@/lib/realtime/protocol';
import { SESSION_COOKIE } from '../auth/session-cookie-name';
import { createSession, deleteSession } from '../auth/sessions';
import type { AppDatabase } from '../db/client';
import { createTestDatabase, createTestUser } from '../testing/test-database';
import { createSocketServer, SOCKET_PATH, type RealtimeServer } from './socket-server';

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const ROOM: CreateRoomInput = {
  name: 'Integration room',
  password: '',
  options: { rules: BASIC_RULES, turnSeconds: null, allowSpectators: true, format: 'single' },
  hostColor: 'red',
};

let db: AppDatabase;
let httpServer: HttpServer;
let realtime: RealtimeServer;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  db = createTestDatabase();
  httpServer = createServer();
  realtime = createSocketServer(httpServer, { db, logger: pino({ level: 'silent' }) });
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${String((httpServer.address() as AddressInfo).port)}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await realtime.close();
});

function client(token?: string): Client {
  const socket: Client = connect(url, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    forceNew: true,
    ...(token && { extraHeaders: { cookie: `${SESSION_COOKIE}=${token}` } }),
  });
  clients.push(socket);
  return socket;
}

async function signedInClient(username: string): Promise<Client> {
  const user = await createTestUser(db, username);
  const { token } = createSession(db, user.id);
  const socket = client(token);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Resolves with the next event payload that satisfies `predicate`. */
function nextEvent<E extends keyof ServerToClientEvents>(
  socket: Client,
  event: E,
  predicate: (payload: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => {
    const listener = (payload: Parameters<ServerToClientEvents[E]>[0]) => {
      if (!predicate(payload)) return;
      socket.off(event, listener as never);
      resolve(payload);
    };
    socket.on(event, listener as never);
  });
}

describe('socket server', () => {
  it('refuses connections without a valid session', async () => {
    const error = await new Promise<Error>((resolve) =>
      client('forged-token').once('connect_error', resolve),
    );

    expect(error.message).toBe('UNAUTHENTICATED');
  });

  it('refuses commands once the session has ended, and disconnects', async () => {
    const user = await createTestUser(db, 'mallory');
    const { token } = createSession(db, user.id);
    const socket = client(token);
    await new Promise<void>((resolve) => socket.once('connect', resolve));
    const disconnected = new Promise<void>((resolve) =>
      socket.once('disconnect', () => {
        resolve();
      }),
    );

    deleteSession(db, token);
    const result = await socket.emitWithAck('room:create', ROOM);

    expect(result).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    await disconnected;
  });

  it('answers invalid payloads with INVALID_INPUT', async () => {
    const alice = await signedInClient('alice');

    const result = await alice.emitWithAck('room:create', {
      name: '',
      password: '',
    } as unknown as CreateRoomInput);

    expect(result).toEqual({ ok: false, error: 'INVALID_INPUT' });
  });

  it('runs a room from the lobby to a played move, keeping hands private', async () => {
    const alice = await signedInClient('alice');
    const bob = await signedInClient('bob');

    bob.emit('lobby:subscribe');
    const lobbyUpdate = nextEvent(
      bob,
      'lobby:rooms',
      (rooms: readonly RoomSummary[]) => rooms.length === 1,
    );
    const created = await alice.emitWithAck('room:create', ROOM);
    if (!created.ok) throw new Error(created.error);
    const { roomId } = created.data;
    expect((await lobbyUpdate)[0]).toMatchObject({ id: roomId, host: 'alice', status: 'waiting' });

    const aliceStarted = nextEvent(
      alice,
      'room:state',
      (s: RoomSnapshot) => s.status === 'playing',
    );
    const bobStarted = nextEvent(bob, 'room:state', (s: RoomSnapshot) => s.status === 'playing');
    expect(await bob.emitWithAck('room:join', { roomId, password: '', as: 'player' })).toEqual({
      ok: true,
      data: null,
    });
    const [aliceView, bobView] = await Promise.all([aliceStarted, bobStarted]);

    const aliceColor = aliceView.you.color;
    const bobColor = bobView.you.color;
    if (!aliceColor || !bobColor) throw new Error('both players should have a colour');
    expect(aliceView.game?.view.players[aliceColor].hand.cards).not.toBeNull();
    expect(aliceView.game?.view.players[bobColor].hand.cards).toBeNull();

    const [mover, moverView, watcher] =
      aliceView.game?.view.activePlayer === aliceColor
        ? [alice, aliceView, bob]
        : [bob, bobView, alice];
    const color = moverView.you.color ?? 'red';
    const card = moverView.game?.view.players[color].hand.cards?.[0];
    if (!card) throw new Error('mover should see their hand');

    const watcherUpdate = nextEvent(
      watcher,
      'room:state',
      (s: RoomSnapshot) => s.game?.lastMove !== null,
    );
    expect(
      await mover.emitWithAck('game:move', {
        roomId,
        instanceId: card.instanceId,
        position: 4,
      }),
    ).toEqual({ ok: true, data: null });
    const update = await watcherUpdate;

    expect(update.game?.view.board[4]?.placed?.instanceId).toBe(card.instanceId);
    expect(update.game?.cards[card.card.id]).toBeDefined();
  });

  it('sends the current state to a connection that re-joins a room it is already in', async () => {
    const alice = await signedInClient('alice');
    const carol = await signedInClient('carol');
    const created = await alice.emitWithAck('room:create', ROOM);
    if (!created.ok) throw new Error(created.error);
    const { roomId } = created.data;
    await carol.emitWithAck('room:join', { roomId, password: '', as: 'spectator' });

    const state = nextEvent(carol, 'room:state');
    await carol.emitWithAck('room:join', { roomId, password: '', as: 'spectator' });

    expect((await state).you.role).toBe('spectator');
  });

  it('pauses the game when a player closes their last connection', async () => {
    const alice = await signedInClient('alice');
    const bob = await signedInClient('bob');
    const created = await alice.emitWithAck('room:create', ROOM);
    if (!created.ok) throw new Error(created.error);
    const { roomId } = created.data;
    await bob.emitWithAck('room:join', { roomId, password: '', as: 'player' });

    const paused = nextEvent(bob, 'room:state', (s: RoomSnapshot) => s.game?.paused !== null);
    alice.disconnect();

    expect((await paused).game?.paused?.username).toBe('alice');
  });
});
