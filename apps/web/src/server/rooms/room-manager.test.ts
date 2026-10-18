import { BASIC_RULES, POSITIONS, type CardDefinition, type StatValue } from '@triple-triad/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECONNECT_GRACE_MS,
  ROUND_BREAK_MS,
  type CardInfo,
  type CreateRoomInput,
  type RoomOptions,
} from '@/lib/realtime/protocol';
import type { DeckProvider } from './game-decks';
import type { FinishedGame, GameDeck, RoomUser } from './model';
import { RoomManager, type RoomEvents } from './room-manager';

const alice: RoomUser = { id: 'alice', username: 'Alice' };
const bob: RoomUser = { id: 'bob', username: 'Bob' };
const carol: RoomUser = { id: 'carol', username: 'Carol' };
const dave: RoomUser = { id: 'dave', username: 'Dave' };
const erin: RoomUser = { id: 'erin', username: 'Erin' };

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

/** A 20-card deck from [card id, stat value for every side, copies]. */
function mixedDeck(parts: readonly (readonly [string, StatValue, number])[]): GameDeck {
  const pieces = parts.map(([cardId, value, copies]) => {
    const deck = uniformDeck(cardId, value);
    return { cards: deck.cards.slice(0, copies), faces: [...deck.faces] };
  });
  return {
    cards: pieces.flatMap((piece) => piece.cards),
    faces: new Map(pieces.flatMap((piece) => piece.faces)),
  };
}

const decks: Record<string, GameDeck> = {
  alice: uniformDeck('alice-card', 9),
  bob: uniformDeck('bob-card', 1),
  carol: uniformDeck('carol-card', 5),
  // Same strength as Carol: their games never capture anything and end 5–5.
  dave: uniformDeck('dave-card', 5),
  // Twelve 5s (no captures against Dave) and eight 9s (beat Dave's 5s): see playPreferring.
  erin: mixedDeck([
    ['erin-five', 5, 12],
    ['erin-nine', 9, 8],
  ]),
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
  format: 'single',
  carryHand: false,
  ...overrides,
});

const roomInput = (overrides: Partial<CreateRoomInput> = {}): CreateRoomInput => ({
  name: 'Friday Duel',
  password: '',
  options: options(),
  hostColor: 'red',
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

/**
 * The host creates a room (red unless `input` says otherwise) and the guest joins; the coin flip
 * makes the host go first when `hostFirst`.
 */
function startedGame(
  manager: RoomManager,
  input = roomInput(),
  hostFirst = true,
  host: RoomUser = alice,
  guest: RoomUser = bob,
) {
  coinFlip = hostFirst;
  const created = manager.createRoom(host, input);
  if (!created.ok) throw new Error(created.error);
  const joined = manager.joinRoom(guest, {
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

  it('starts the game when the second player joins; the coin flip picks who goes first', () => {
    const manager = createManager();
    const roomId = startedGame(manager, roomInput(), false);

    const game = manager.snapshot(roomId, alice.id)?.game;

    expect(manager.listRooms()[0]?.status).toBe('playing');
    expect(game?.players.red.username).toBe('Alice');
    expect(game?.players.blue.username).toBe('Bob');
    expect(game?.view.activePlayer).toBe('blue');
    expect(game?.firstPlayer).toEqual({ color: 'blue', reason: 'coin-flip' });
  });

  it('gives the host the colour they chose and the guest the other one', () => {
    const manager = createManager();
    const roomId = startedGame(manager, roomInput({ hostColor: 'blue' }));

    const snapshot = manager.snapshot(roomId, bob.id);

    expect(manager.listRooms()[0]?.hostColor).toBe('blue');
    expect(snapshot?.hostColor).toBe('blue');
    expect(snapshot?.you.color).toBe('red');
    expect(snapshot?.game?.players.blue.username).toBe('Alice');
    // The host won the coin flip, so blue goes first.
    expect(snapshot?.game?.view.activePlayer).toBe('blue');
  });

  it('keeps the host colour for whoever becomes host when the creator disconnects', () => {
    const manager = createManager();
    manager.createRoom(alice, roomInput({ hostColor: 'blue' }));
    manager.joinRoom(bob, { roomId: 'room-1', password: '', as: 'player' });
    manager.disconnected(alice.id, 'room-1');
    vi.advanceTimersByTime(RECONNECT_GRACE_MS);

    manager.joinRoom(carol, { roomId: 'room-1', password: '', as: 'player' });

    expect(manager.snapshot('room-1', bob.id)?.you.color).toBe('blue');
    expect(manager.snapshot('room-1', carol.id)?.you.color).toBe('red');
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
      deadline: 0,
      votes: { alice: null, bob: null },
    });
  });

  it('starts a new game with the loser going first and colours unchanged', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    playToEnd(manager, roomId);
    // Alice's 9s beat Bob's 1s, so Bob (blue) lost.
    expect(finished[0]?.result.winner).toBe('red');

    manager.vote(alice.id, roomId, 'continue');
    manager.vote(bob.id, roomId, 'continue');
    const game = manager.snapshot(roomId, alice.id)?.game;

    expect(manager.snapshot(roomId, alice.id)?.status).toBe('playing');
    expect(game?.players.red.username).toBe('Alice');
    expect(game?.players.blue.username).toBe('Bob');
    expect(game?.view.activePlayer).toBe('blue');
    expect(game?.firstPlayer).toEqual({ color: 'blue', reason: 'lost-last-game' });
    expect(game?.view.turn).toBe(1);
  });

  it('lets the same player go first again after a draw', () => {
    const manager = createManager();
    const roomId = startedGame(manager, roomInput(), false, carol, dave);
    playToEnd(manager, roomId);
    expect(finished[0]?.result.winner).toBeNull();

    manager.vote(carol.id, roomId, 'continue');
    manager.vote(dave.id, roomId, 'continue');
    const game = manager.snapshot(roomId, carol.id)?.game;

    expect(game?.players.red.username).toBe('Carol');
    expect(game?.firstPlayer).toEqual({ color: 'blue', reason: 'last-game-drawn' });
    expect(game?.view.activePlayer).toBe('blue');
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

  it('keeps the rematch vote open indefinitely', () => {
    const manager = createManager();
    const roomId = startedGame(manager);
    playToEnd(manager, roomId);
    manager.vote(alice.id, roomId, 'continue');

    vi.advanceTimersByTime(5 * 60_000);

    const snapshot = manager.snapshot(roomId, alice.id);
    expect(snapshot?.rematch?.votes).toEqual({ alice: 'continue', bob: null });
    expect(snapshot?.seats.map((seat) => seat.username)).toEqual(['Alice', 'Bob']);
  });
});

describe('closeAllRooms', () => {
  it('ends every room and frees its players to join another', () => {
    const manager = createManager();
    startedGame(manager);

    manager.closeAllRooms('The server is being restored.');

    expect(manager.listRooms()).toEqual([]);
    expect(manager.roomOfPlayer(alice.id)).toBeNull();
    expect(events.roomClosed).toHaveBeenCalledWith('room-1', 'The server is being restored.');
    expect(events.lobbyChanged).toHaveBeenCalled();
  });
});

describe('leaving and disconnecting', () => {
  it('forfeits a game in progress when a player leaves and closes the room', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    manager.leaveRoom(bob.id, roomId);

    expect(finished[0]).toMatchObject({ forfeit: true, result: { winner: 'red' } });
    expect(manager.listRooms()).toEqual([]);
    expect(events.roomClosed).toHaveBeenCalledWith(roomId, 'Bob left the room');
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

  it('closes the room when the host leaves mid-game', () => {
    const manager = createManager();
    const roomId = startedGame(manager);

    manager.leaveRoom(alice.id, roomId);

    expect(manager.listRooms()).toEqual([]);
    expect(events.roomClosed).toHaveBeenCalledWith(roomId, 'Alice left the room');
  });

  it('closes the room when the last player leaves', () => {
    const manager = createManager();
    manager.createRoom(alice, roomInput());

    manager.leaveRoom(alice.id, 'room-1');

    expect(manager.listRooms()).toEqual([]);
    expect(events.roomClosed).toHaveBeenCalledWith('room-1', undefined);
    expect(manager.roomOfPlayer(alice.id)).toBeNull();
  });
});

/** Plays the active player's card with this id if they hold one (else their first card). */
function playPreferring(manager: RoomManager, roomId: string, cardId: string) {
  const anyView = manager.snapshot(roomId, alice.id)?.game;
  if (!anyView) throw new Error('No game');
  const active = anyView.view.activePlayer;
  const user = anyView.players[active].userId;
  const view = manager.snapshot(roomId, user)?.game?.view;
  if (!view) throw new Error('No game view');
  const hand = view.players[active].hand.cards ?? [];
  const card = hand.find((candidate) => candidate.card.id === cardId) ?? hand[0];
  const position = POSITIONS.find((p) => view.board[p]?.placed === null);
  if (!card || position === undefined) throw new Error('No move available');
  const result = manager.playMove(user, { roomId, instanceId: card.instanceId, position });
  if (!result.ok) throw new Error(result.error);
}

describe('matches of several rounds', () => {
  const untilWinner = () => roomInput({ options: options({ format: 'until-winner' }) });

  it('follows a drawn round with another, after a break, with the other player starting', () => {
    const manager = createManager();
    // Carol and Dave both have only 5s: nothing is ever captured, so every round is drawn.
    const roomId = startedGame(manager, untilWinner(), true, carol, dave);

    playToEnd(manager, roomId);
    const between = manager.snapshot(roomId, carol.id);

    expect(between?.status).toBe('playing');
    expect(between?.game?.view.result).toEqual({ winner: null, score: { red: 5, blue: 5 } });
    expect(between?.game?.match).toEqual({
      format: 'until-winner',
      round: 1,
      roundResults: [{ winner: null, score: { red: 5, blue: 5 } }],
      seriesScore: { red: 0, blue: 0 },
      nextRoundAt: Date.now() + ROUND_BREAK_MS,
      // Carol (red) went first and placed 5 cards; Dave placed 4.
      cardsLeft: { red: 15, blue: 16 },
    });
    expect(between?.rematch).toBeNull();
    expect(finished).toEqual([]);
    expect(manager.playMove(carol.id, { roomId, instanceId: 'x', position: 0 })).toEqual({
      ok: false,
      error: 'NOT_PLAYING',
    });

    vi.advanceTimersByTime(ROUND_BREAK_MS);
    const game = manager.snapshot(roomId, carol.id)?.game;

    expect(game?.match).toMatchObject({
      round: 2,
      nextRoundAt: null,
      cardsLeft: { red: 15, blue: 16 },
    });
    expect(game?.firstPlayer).toEqual({ color: 'blue', reason: 'round-drawn' });
    expect(game?.view.activePlayer).toBe('blue');
    expect(game?.view.result).toBeNull();
    // Dave draws for his first turn from what is left: 16 − 3 in hand − 1 drawn.
    expect(game?.view.players.blue.drawPileSize).toBe(12);
  });

  it('is a draw, recorded once, when every round the decks allow is drawn', () => {
    const manager = createManager();
    const roomId = startedGame(manager, untilWinner(), true, carol, dave);

    for (let round = 1; round <= 3; round++) {
      playToEnd(manager, roomId);
      if (round < 3) vi.advanceTimersByTime(ROUND_BREAK_MS);
    }
    const snapshot = manager.snapshot(roomId, carol.id);

    expect(snapshot?.status).toBe('finished');
    expect(snapshot?.game?.match).toMatchObject({ round: 3, nextRoundAt: null });
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ rounds: 3, forfeit: false, result: { winner: null } });

    // The next match starts with full decks, and the player who started this one starts again.
    manager.vote(carol.id, roomId, 'continue');
    manager.vote(dave.id, roomId, 'continue');
    const next = manager.snapshot(roomId, carol.id)?.game;
    expect(next?.match).toMatchObject({
      round: 1,
      roundResults: [],
      seriesScore: { red: 0, blue: 0 },
      cardsLeft: { red: 20, blue: 20 },
    });
    expect(next?.firstPlayer).toEqual({ color: 'red', reason: 'last-game-drawn' });
  });

  it('plays all 3 rounds even if one player wins early; match winner has most round wins', () => {
    const manager = createManager();
    const roomId = startedGame(manager, untilWinner(), true, erin, dave);

    // Round 1: Erin only plays 5s, so nothing is captured — draw.
    for (let turn = 0; turn < 9; turn++) playPreferring(manager, roomId, 'erin-five');
    expect(manager.snapshot(roomId, erin.id)?.game?.view.result?.winner).toBeNull();
    vi.advanceTimersByTime(ROUND_BREAK_MS);

    // Round 2: her 9s beat Dave's 5s — Erin wins this round.
    for (let turn = 0; turn < 9; turn++) playPreferring(manager, roomId, 'erin-nine');
    expect(manager.snapshot(roomId, erin.id)?.status).toBe('playing');
    expect(manager.snapshot(roomId, erin.id)?.game?.match.seriesScore).toEqual({ red: 1, blue: 0 });
    vi.advanceTimersByTime(ROUND_BREAK_MS);

    // Round 3: Erin plays remaining cards (mix of 5s and 9s).
    playToEnd(manager, roomId);

    expect(manager.snapshot(roomId, erin.id)?.status).toBe('finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ rounds: 3, result: { winner: 'red' } });
    expect(manager.snapshot(roomId, erin.id)?.rematch).not.toBeNull();
  });

  it('is lost by a player who leaves between rounds and closes the room', () => {
    const manager = createManager();
    const roomId = startedGame(manager, untilWinner(), true, carol, dave);
    playToEnd(manager, roomId);

    manager.leaveRoom(carol.id, roomId);

    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ forfeit: true, rounds: 1, result: { winner: 'blue' } });
    expect(manager.listRooms()).toEqual([]);
    expect(events.roomClosed).toHaveBeenCalledWith(roomId, 'Carol left the room');
  });

  it('starts the next round paused while a player is away, and resumes when they return', () => {
    const manager = createManager();
    const roomId = startedGame(manager, untilWinner(), true, carol, dave);
    playToEnd(manager, roomId);

    manager.disconnected(dave.id, roomId);
    expect(manager.snapshot(roomId, carol.id)?.game?.paused).toBeNull();
    vi.advanceTimersByTime(ROUND_BREAK_MS);

    const paused = manager.snapshot(roomId, carol.id)?.game;
    expect(paused?.match.round).toBe(2);
    expect(paused?.paused).toEqual({
      username: 'Dave',
      forfeitAt: Date.now() - ROUND_BREAK_MS + RECONNECT_GRACE_MS,
    });
    expect(paused?.turnDeadline).toBeNull();

    manager.joinRoom(dave, { roomId, password: '', as: 'player' });
    const resumed = manager.snapshot(roomId, carol.id)?.game;
    expect(resumed?.paused).toBeNull();
    expect(resumed?.turnDeadline).toBe(Date.now() + 30_000);
  });

  it('ends after one round in single-game rooms', () => {
    const manager = createManager();
    const roomId = startedGame(manager, roomInput(), true, carol, dave);

    playToEnd(manager, roomId);

    expect(manager.snapshot(roomId, carol.id)?.status).toBe('finished');
    expect(finished[0]).toMatchObject({ rounds: 1, result: { winner: null } });
  });
});
