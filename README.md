# Triple Triad Online

A self-hosted, two-player, browser-based version of **Triple Triad**, the card game from
Final Fantasy VIII, with player accounts, a Yu-Gi-Oh-style card collection, a custom card maker and
uploadable art packs.

> **Status:** in development. Working today: accounts, trunks and starter decks, live two-player
> games (lobby, every FF8 rule, turn timers, spectators, reconnects, rematches), a card maker with
> art uploads and a deck editor. Ratings, the admin panel and custom asset packs are next — see
> [Roadmap](#roadmap).

The full product specification lives in [`design/SPEC.md`](design/SPEC.md).

## Highlights

- **Pure, deterministic rules engine** (`packages/engine`): no I/O, no clock, no `Math.random()`.
  Game state is plain immutable data and every random decision comes from a seed stored in the
  state, so any game can be replayed exactly from its seed and moves. Enforced by lint rules.
- **Server-authoritative multiplayer**: clients send intents over a typed, zod-validated Socket.IO
  protocol; the server validates every move with the engine and sends each participant a
  personalised snapshot that hides the opponent's hand and both draw piles. The room manager's
  clock, randomness and deck loading are injected, so turn timers, reconnect windows and rematch
  votes are tested deterministically.
- **One process, one port**: a custom Node server hosts Next.js, the Socket.IO real-time channel
  and a health check, so it runs the same behind a local tunnel or on a VPS.
- **Complete FF8 rule set**: Same, Same Wall, Plus, Combo chains and Elemental squares, plus this
  project's own draw-per-turn, deck-building and card-ranking rules.
- **Careful authentication**: Argon2id password hashes (OWASP parameters), session tokens stored
  only as SHA-256 hashes, constant-time responses for unknown users, and login throttling.
- **Integrity in the database, not just the code**: foreign keys, CHECK constraints for every enum
  and stat range, and a partial unique index allowing one default starter deck. Migrations are
  generated SQL, committed, and applied automatically at startup.
- **Tested at every level**: engine unit tests, data-layer tests against a real in-memory SQLite
  with the real migrations (no mocks), and Playwright end-to-end tests against the production
  build.

## Architecture

```text
Browser ──HTTP──▶ ┌──────────────────────────── apps/web (Node) ───────────────────────────┐
        ◀─WS────▶ │  custom server (src/server)                                             │
                  │   ├─ GET /healthz                                                       │
                  │   ├─ Socket.IO  /socket.io  ── real-time game traffic                   │
                  │   └─ Next.js    everything else (React UI, server components, routes)   │
                  │                        │                                                │
                  │            ┌───────────┴────────────┐                                   │
                  │            ▼                        ▼                                   │
                  │   packages/engine           SQLite (Drizzle ORM)                        │
                  │   pure rules: moves,        users, sessions, cards, trunk,              │
                  │   captures, scoring,        decks, starter decks                        │
                  │   ranking, deck checks                                                  │
                  └─────────────────────────────────────────────────────────────────────────┘
```

Inside `apps/web/src`:

| Folder        | Responsibility                                                                     |
| ------------- | ---------------------------------------------------------------------------------- |
| `app/`        | Routes: pages and server actions. Thin: they validate input and call `server/`.    |
| `components/` | React components (Balamb Classic theme).                                           |
| `server/`     | Server-only domain code: database, auth, users, decks, trunk, catalogue, realtime. |
| `server/web/` | The only code that touches Next.js request APIs (cookies, current user).           |
| `lib/`        | Code shared by server and browser (validation rules, formatting).                  |

| Path                   | What it is                                                                     |
| ---------------------- | ------------------------------------------------------------------------------ |
| `packages/engine`      | Rules engine. Framework-free TypeScript, unit-tested to ≥ 95 % coverage.       |
| `apps/web`             | Next.js app and the custom server (`src/server`) that hosts it with Socket.IO. |
| `packages/card-layout` | Card face layout (positions of every element) shared by renderer and tools.    |
| `design/`              | Specification, artist templates and theme mockups.                             |
| `.github/workflows`    | CI: formatting, lint, type-check, tests, coverage gate, build and end-to-end.  |

### Engine at a glance

```ts
import { applyMove, createGame, viewFor } from '@triple-triad/engine';

let state = createGame({ rules, decks: { red, blue }, seed });
const result = applyMove(state, { player: 'red', instanceId, position: 4 });
if (result.ok) {
  state = result.state; // new immutable state
  result.captures; // [{ position: 1, cause: 'same', from: 'blue', to: 'red', wave: 0 }, …]
}
const forBlue = viewFor(state, 'blue'); // what blue is allowed to see
```

Illegal moves return a typed error (`NOT_YOUR_TURN`, `CELL_OCCUPIED`, …) instead of throwing.

## Getting started

**Requirements:** Node.js 24+ and pnpm 11+ (`corepack enable` sets up the pinned pnpm version).

```bash
pnpm install
pnpm dev            # http://127.0.0.1:3000
```

Configuration is read from environment variables (or `apps/web/.env`), validated at startup.
See [`apps/web/.env.example`](apps/web/.env.example):

| Variable    | Default       | Description                                                  |
| ----------- | ------------- | ------------------------------------------------------------ |
| `HOST`      | `127.0.0.1`   | Interface to bind to. Use `0.0.0.0` inside a container.      |
| `PORT`      | `3000`        | HTTP and WebSocket port.                                     |
| `LOG_LEVEL` | `info`        | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` |
| `NODE_ENV`  | `development` | `development`, `production` or `test`.                       |
| `DATA_DIR`  | `./data`      | Where the SQLite database and uploaded files are stored.     |

The database is created and migrated on first start, and the default cards and starter decks are
inserted. **The first account to sign up becomes the admin.**

### Production

```bash
pnpm build          # Next.js build + bundled custom server (apps/web/dist/server.mjs)
pnpm start          # serves on HOST:PORT; GET /healthz returns {"status":"ok"}
```

The server shuts down gracefully on `SIGINT`/`SIGTERM`.

## Scripts

Run from the repository root; each runs across all workspace packages.

| Command          | Does                                         |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Start the app with hot reload.               |
| `pnpm build`     | Production build.                            |
| `pnpm start`     | Run the production build.                    |
| `pnpm test`      | Unit tests (Vitest).                         |
| `pnpm test:e2e`  | End-to-end tests (Playwright); build first.  |
| `pnpm lint`      | ESLint (strict, type-aware).                 |
| `pnpm typecheck` | TypeScript in strict mode.                   |
| `pnpm format`    | Format with Prettier (`format:check` in CI). |

## Roadmap

1. ~~Project setup: monorepo, strict TypeScript, lint, tests, CI, custom server, theme~~
2. ~~Rules engine with tests~~
3. ~~Accounts, trunk and starter decks (SQLite)~~
4. ~~Card renderer and default asset pack~~
5. ~~Lobby and live play: rooms, coin flip, turn timer, reconnects, rematch~~
6. ~~Card maker and deck editor~~
7. Rating, tiers and streaks
8. Admin panel
9. Custom asset pack uploads, Docker image and VPS deployment guide
