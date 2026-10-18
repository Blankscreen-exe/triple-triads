import { BASIC_RULES, POSITIONS, type CardDefinition, type StatValue } from '@triple-triad/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardInfo, CreateRoomInput, RoomOptions } from '@/lib/realtime/protocol';
import type { DeckProvider } from './game-decks';
import type { FinishedGame, GameDeck, RoomUser } from './model';
import { RECONNECT_GRACE_MS, REMATCH_VOTE_MS } from '@/lib/realtime/protocol';
import { RoomManager, type RoomEvents } from './room-manager';

const alice: RoomUser = { id: 'alice', username: 'Alice' };
const bob: RoomUser = { id: 'bob', username: 'Bob' };
const carol: RoomUser = { id: 'carol', username: 'Carol' };

/** A 20-card deck where every card has the same stats. */
function uniformDeck(cardId: string, value: StatValue): GameDeck {
  const definition: CardDefinition = {
    id: cardId,
    stats: { top: value, right: value, bottom: value, left: value },
    element: null,
  };
  const face: CardInfo = {
    name: cardId,
    stats: definition.stats,
    element: null,
    stars: 1,
    artUrl: null,
  };
  return { cards: Array.from({ length: 20 }, () => definition), faces: new Map([[cardId, face]]) };
}

const decks: Record<string, GameDeck> = {
  alice: uniformDeck('alice-card', 9),
  bob: uniformDeck('bob-card', 1),
  carol: uniformDeck('carol-card', 5),
};

const deckProvider: DeckProvider = {
  loadActiveDeck: (userId) => {
    const deck = decks[userId];
    return deck ? { ok: true, deck } : { ok: false, error: 'NO_ACTIVE_DECK' };
  },
};

const options = (overrides: Partial<RoomOptions> = {}): RoomOptions => ({
  rules: BASIC_RULES,
  turnSeconds: 30,
  allowSpectators: true,
  ...overrides,
});

const roomInput = (overrides: Partial<CreateRoomInput> = {}): CreateRoomInput => ({
  name: 'Friday Duel',
  password: '',
  options: options(),
  ...overrides,
});

let events: { [K in keyof RoomEvents]: ReturnType<typeof vi.fn> };
let finished: FinishedGame[];
let coinFlip: boolean;

function createManager() {
  return new RoomManager({
    decks: deckProvider,
    events: events as unknown as RoomEvents,
    onGameFinished: (game) => {
      finished.push(game);
      return undefined;
    },
    coinFlip: () => coinFlip,
    newSeed: () => 1234,
    newRoomId: () => 'room-1',
  });
}

/** Alice creates a room and Bob joins; Alice is red when `aliceFirst`. */
function startedGame(manager: RoomManager, input = roomInput(), aliceFirst = true) {
  coinFlip = aliceFirst;
  const created = manager.createRoom(alice, input);
  if (!created.ok) throw new Error(created.error);
  const joined = manager.joinRoom(bob, {
    roomId: 'room-1',
    password: input.password,
    as: 'player',
  });
  if (!joined.ok) throw new Error(joined.error);
  return 'room-1';
}

/** Plays the active player's first card on the first empty square. */
function playFirstMove(manager: RoomManager, roomId: string) {
  const anyView = manager.snapshot(roomId, alice.id)?.game;
  if (!anyView) throw new Error('No game');
  const active = anyView.view.activePlayer;
  const user = anyView.players[active].userId;
  const view = manager.snapshot(roomId, user)?.game?.view;
  if (!view) throw new Error('No game view');
  const card = view.players[active].hand.cards?.[0];
  const position = POSITIONS.find((p) => view.board[p]?.placed === null);
  if (!card || position === undefined) throw new Error('No move available');
  return manager.playMove(user, { roomId, instanceId: card.instanceId, position });
}

function playToEnd(manager: RoomManager, roomId: string) {
  for (let turn = 0; turn < 9; turn++) {
    const result = playFirstMove(manager, roomId);
    if (!result.ok) throw new Error(result.error);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  events = { roomChanged: vi.fn(), roomClosed: vi.fn(), lobbyChanged: vi.fn() };
  finished = [];
  coinFlip = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('creating and joining rooms', () => {
  it('lists a new room in the lobby with its host seated', () => {
    const manager = createManager();

    expect(manager.createRoom(alice, roomInput())).toEqual({
      ok: true,
      data: { roomId: 'room-1' },
    });
    expect(manager.listRooms()).toMatchObject([
      { id: 'room-1', name: 'Friday Duel', host: 'Alice', status: 'waiting', players: ['Alice'] },
    ]);
    expect(events.lobbyChanged).toHaveBeenCalled();
  });

  it('applies the admin’s locked room options', () => {
    const manager = new RoomManager({
      decks: deckProvider,
      events: events as unknown as RoomEvents,
      newRoomId: () => 'room-1',
      roomPolicy: () => ({
        defaults: options({ turnSeconds: 60 }),
        locked: ['turnSeconds'],
      }),
    });

    manager.createRoom(alice, roomInput({ options: options({ turnSeconds: null }) }));

    expect(manager.listRooms()[0]?.options.turnSeconds).toBe(60);
  });

  it('needs a usable active deck', () => {
    const manager = createManager();

    expect(manager.createRoom({ id: 'deckless', username: 'D' }, roomInput())).toEqual({
      ok: false,
      error: 'NO_ACTIVE_DECK',
    });
  });

  it('lets a player sit in only one room at a time', () => {
    const manager = createManager();
    manager.createRoom(alice, roomInput());

    expect(manager.createRoom(alice, roomInput())).toEqual({
      ok: false,
      error: 'ALREADY_IN_A_ROOM',
    });
  });

  it('starts the game when the second player joins, with the coin-flip winner as red', () => {
    const manager = createManager();
    const roomId = startedGame(manager, roomInput(), false);

    const game = manager.snapshot(roomId, alice.id)?.game;

    expect(manager.listRooms()[0]?.status).toBe('playing');
    expect(game?.players.red.username).toBe('Bob');
    expect(game?.players.blue.username).toBe('Alice');
    expect(game?.view.activePlayer).toBe('red');
  });

  it('checks the room password', () => {
    const manager = createManager();
    manager.createRoom(alice, roomInput({ password: 'secret' }));

    expect(manager.joinRoom(bob, { roomId: 'room-1', password: 'nope', as: 'player' })).toEqual({
      ok: false,
      error: 'WRONG_PASSWORD',
    });
    expect(manager.joinRoom(bob, { roomId: 'room-1', password: 'secret', as: 'player' }).ok).toBe(
      true,
    );
  });

  it('refuses a third player', () => {
    const manager = createManager();
    startedGame(manager);

    expect(manager.joinRoom(carol, { roomId: 'room-1', password: '', as: 'player' })).toEqual({
      ok: false,
      error: 'ROOM_FULL',
    });
  });
});

describe('spectators', () => {
  it('can watch without seeing either hand', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    expect(manager.joinRoom(carol, { roomId, password: '', as: 'spectator' }).ok).toBe(true);
    const snapshot = manager.snapshot(roomId, carol.id);

    expect(snapshot?.you).toEqual({ userId: 'carol', role: 'spectator', color: null });
    expect(snapshot?.game?.view.players.red.hand.cards).toBeNull();
    expect(snapshot?.game?.view.players.blue.hand.cards).toBeNull();
    expect(snapshot?.game?.cards).toEqual({});
  });

  it('are not asked for the password again while they are watching', () => {
    const manager = createManager();
    startedGame(manager, roomInput({ password: 'secret' }));
    manager.joinRoom(carol, { roomId: 'room-1', password: 'secret', as: 'spectator' });

    expect(manager.joinRoom(carol, { roomId: 'room-1', password: '', as: 'spectator' }).ok).toBe(
      true,
    );
  });

  it('are turned away when the room does not allow them', () => {
    const manager = createManager();
    manager.createRoom(alice, roomInput({ options: options({ allowSpectators: false }) }));

    expect(manager.joinRoom(carol, { roomId: 'room-1', password: '', as: 'spectator' })).toEqual({
      ok: false,
      error: 'SPECTATORS_NOT_ALLOWED',
    });
  });
});

describe('playing', () => {
  it('shows players their own hand and only the size of the opponent’s', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    const game = manager.snapshot(roomId, alice.id)?.game;

    expect(game?.view.players.red.hand.cards).toHaveLength(4);
    expect(game?.view.players.blue.hand).toEqual({ size: 3, cards: null });
    expect(Object.keys(game?.cards ?? {})).toEqual(['alice-card']);
  });

  it('rejects moves out of turn and illegal moves', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    const bobsCard = manager.snapshot(roomId, bob.id)?.game?.view.players.blue.hand.cards?.[0];

    expect(
      manager.playMove(bob.id, { roomId, instanceId: bobsCard?.instanceId ?? '', position: 0 }),
    ).toEqual({
      ok: false,
      error: 'NOT_YOUR_TURN',
    });
    expect(manager.playMove(alice.id, { roomId, instanceId: 'not-a-card', position: 0 })).toEqual({
      ok: false,
      error: 'ILLEGAL_MOVE',
    });
    expect(manager.playMove(carol.id, { roomId, instanceId: 'x', position: 0 })).toEqual({
      ok: false,
      error: 'NOT_A_PLAYER',
    });
  });

  it('applies a legal move and records it as the last move', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    expect(playFirstMove(manager, roomId)).toEqual({ ok: true, data: null });
    const game = manager.snapshot(roomId, bob.id)?.game;

    expect(game?.lastMove).toMatchObject({ player: 'red', position: 0, timedOut: false });
    expect(game?.view.activePlayer).toBe('blue');
  });

  it('plays a random move when the turn timer runs out', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    vi.advanceTimersByTime(30_000);
    const game = manager.snapshot(roomId, alice.id)?.game;

    expect(game?.lastMove).toMatchObject({ player: 'red', timedOut: true });
    expect(game?.view.activePlayer).toBe('blue');
    expect(game?.turnDeadline).toBe(Date.now() + 30_000);
  });

  it('has no turn deadline without a timer', () => {
    const manager = createManager();
    const roomId = startedGame(manager, roomInput({ options: options({ turnSeconds: null }) }));

    vi.advanceTimersByTime(10 * 60_000);

    expect(manager.snapshot(roomId, alice.id)?.game?.turnDeadline).toBeNull();
    expect(manager.snapshot(roomId, alice.id)?.game?.lastMove).toBeNull();
  });
});

describe('finishing and rematches', () => {
  it('reports the finished game and opens a rematch vote', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    playToEnd(manager, roomId);
    const snapshot = manager.snapshot(roomId, alice.id);

    expect(snapshot?.status).toBe('finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ roomId, forfeit: false });
    expect(snapshot?.rematch).toEqual({
      deadline: Date.now() + REMATCH_VOTE_MS,
      votes: { alice: null, bob: null },
    });
  });

  it('starts a new game with the loser as red when both continue', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    playToEnd(manager, roomId);
    const winner = finished[0]?.result.winner;
    if (!winner) throw new Error('expected a winner with these decks');
    const loserName = manager.snapshot(roomId, alice.id)?.game?.players[
      winner === 'red' ? 'blue' : 'red'
    ].username;

    manager.vote(alice.id, roomId, 'continue');
    manager.vote(bob.id, roomId, 'continue');
    const game = manager.snapshot(roomId, alice.id)?.game;

    expect(manager.snapshot(roomId, alice.id)?.status).toBe('playing');
    expect(game?.players.red.username).toBe(loserName);
    expect(game?.view.turn).toBe(1);
  });

  it('ends the room’s pairing when a player votes to leave', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    playToEnd(manager, roomId);

    manager.vote(bob.id, roomId, 'leave');
    const snapshot = manager.snapshot(roomId, alice.id);

    expect(snapshot?.status).toBe('waiting');
    expect(snapshot?.seats.map((seat) => seat.username)).toEqual(['Alice']);
    expect(snapshot?.rematch).toBeNull();
  });

  it('treats no vote as leaving once the vote times out', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    playToEnd(manager, roomId);
    manager.vote(alice.id, roomId, 'continue');

    vi.advanceTimersByTime(REMATCH_VOTE_MS);

    expect(manager.snapshot(roomId, alice.id)?.seats.map((seat) => seat.username)).toEqual([
      'Alice',
    ]);
  });
});

describe('leaving and disconnecting', () => {
  it('forfeits a game in progress when a player leaves', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    manager.leaveRoom(bob.id, roomId);
    const snapshot = manager.snapshot(roomId, alice.id);

    expect(finished[0]).toMatchObject({ forfeit: true, result: { winner: 'red' } });
    expect(snapshot?.status).toBe('waiting');
    expect(snapshot?.game?.forfeit).toBe(true);
  });

  it('pauses the game while a player is disconnected and resumes the turn timer', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    vi.advanceTimersByTime(10_000); // 20 s left on red's turn

    manager.disconnected(alice.id, roomId);
    vi.advanceTimersByTime(60_000);
    const paused = manager.snapshot(roomId, bob.id)?.game;

    expect(paused?.paused).toEqual({
      username: 'Alice',
      forfeitAt: Date.now() + RECONNECT_GRACE_MS - 60_000,
    });
    expect(paused?.turnDeadline).toBeNull();
    expect(paused?.lastMove).toBeNull();

    manager.joinRoom(alice, { roomId, password: '', as: 'player' });

    expect(manager.snapshot(roomId, bob.id)?.game?.turnDeadline).toBe(Date.now() + 20_000);
  });

  it('forfeits for a player who does not come back in time', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    manager.disconnected(alice.id, roomId);
    vi.advanceTimersByTime(RECONNECT_GRACE_MS);

    expect(finished[0]).toMatchObject({ forfeit: true, result: { winner: 'blue' } });
    expect(manager.snapshot(roomId, bob.id)?.seats.map((seat) => seat.username)).toEqual(['Bob']);
  });

  it('hands the room to the other player when the host leaves', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    manager.leaveRoom(alice.id, roomId);

    expect(manager.snapshot(roomId, bob.id)?.hostId).toBe('bob');
    expect(manager.listRooms()[0]?.host).toBe('Bob');
  });

  it('closes the room when the last player leaves', () => {
    const manager = createManager();
    manager.createRoom(alice, roomInput());

    manager.leaveRoom(alice.id, 'room-1');

    expect(manager.listRooms()).toEqual([]);
    expect(events.roomClosed).toHaveBeenCalledWith('room-1');
    expect(manager.roomOfPlayer(alice.id)).toBeNull();
  });
});
