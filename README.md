# Triple Triad Online

A self-hosted, two-player, browser-based version of **Triple Triad**, the card game from
Final Fantasy VIII, with player accounts, a Yu-Gi-Oh-style card collection, a custom card maker and
uploadable art packs.

> **Status:** in development. The rules engine is complete and fully tested; the web server
> skeleton (Next.js + Socket.IO on one port) is in place. Accounts, lobby, live play, card maker,
> deck editor and admin panel are next — see [Roadmap](#roadmap).

The full product specification lives in [`design/SPEC.md`](design/SPEC.md).

## Highlights

- **Pure, deterministic rules engine** (`packages/engine`): no I/O, no clock, no `Math.random()`.
  Game state is plain immutable data and every random decision comes from a seed stored in the
  state, so any game can be replayed exactly from its seed and moves. Enforced by lint rules.
- **Server-authoritative multiplayer**: clients send intents, the server validates every move with
  the engine and sends each player a _view_ that hides the opponent's hand and both draw piles.
- **One process, one port**: a custom Node server hosts Next.js, the Socket.IO real-time channel
  and a health check, so it runs the same behind a local tunnel or on a VPS.
- **Complete FF8 rule set**: Same, Same Wall, Plus, Combo chains and Elemental squares, plus this
  project's own draw-per-turn, deck-building and card-ranking rules.

## Architecture

```text
Browser ──HTTP──▶ ┌──────────────────────────── apps/web (Node) ───────────────────────────┐
        ◀─WS────▶ │  custom server (src/server)                                             │
                  │   ├─ GET /healthz                                                       │
                  │   ├─ Socket.IO  /socket.io  ── real-time game traffic                   │
                  │   └─ Next.js    everything else (React UI, server components, routes)   │
                  │                        │                                                │
                  │                        ▼                                                │
                  │          packages/engine  (pure rules: moves, captures, scoring,        │
                  │                            card ranking, deck validation, player views) │
                  └─────────────────────────────────────────────────────────────────────────┘
```

| Path                | What it is                                                                     |
| ------------------- | ------------------------------------------------------------------------------ |
| `packages/engine`   | Rules engine. Framework-free TypeScript, unit-tested to ≥ 95 % coverage.       |
| `apps/web`          | Next.js app and the custom server (`src/server`) that hosts it with Socket.IO. |
| `design/`           | Specification, card layout (`card-layout.json`), artist templates and mockups. |
| `.github/workflows` | CI: formatting, lint, type-check, tests, coverage gate and production build.   |

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
| `pnpm lint`      | ESLint (strict, type-aware).                 |
| `pnpm typecheck` | TypeScript in strict mode.                   |
| `pnpm format`    | Format with Prettier (`format:check` in CI). |

## Roadmap

1. ~~Project setup: monorepo, strict TypeScript, lint, tests, CI, custom server, theme~~
2. ~~Rules engine with tests~~
3. Accounts, trunk and starter decks (SQLite)
4. Card renderer and default asset pack
5. Lobby and live play: rooms, coin flip, turn timer, reconnects, rematch
6. Card maker and deck editor
7. Rating, tiers and streaks
8. Admin panel
9. Custom asset pack uploads, Docker image and VPS deployment guide
