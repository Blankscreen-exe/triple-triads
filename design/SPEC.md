# Triple Triad Online — Specification

Status: design agreed, not yet built. Last updated 2026-10-15.

A self-hosted, two-player, browser-based version of Triple Triad (the card game from Final Fantasy VIII), with player accounts, a Yu-Gi-Oh-style card collection ("trunk") and deck editor, a custom card maker, uploadable art packs, and an admin panel.

Items marked **(default)** are proposals accepted as starting values; they can be changed in the admin panel or revisited later.

---

## 1. Hosting and deployment

- The whole app (pages, API, real-time game connection) runs as **one Node process on one port**.
- Local use: serve on `localhost:<port>`; the owner exposes it to the internet with their own Cloudflare-based tunnel tool. Cloudflare passes WebSockets through, so no extra setup is needed.
- Must also run on a **VPS** (plain Node or Docker, behind a Cloudflare tunnel or a reverse proxy such as Caddy/nginx) with no code changes.
- All environment-specific values (port, database path, storage backend, MinIO credentials) live in a config file / environment variables.

## 2. Tech stack

| Part          | Choice                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web framework | **Next.js** (pages, API routes, React UI)                                                                                                                                       |
| Real-time     | **Socket.IO** attached to a custom Next.js Node server (same process, same port)                                                                                                |
| Database      | **SQLite**                                                                                                                                                                      |
| File storage  | Storage layer with two interchangeable backends: **local folder** (default) and **MinIO**, chosen in config                                                                     |
| Rules engine  | `packages/engine`: pure, deterministic TypeScript package shared by server and client. **The server is authoritative**: it validates every move; the client only displays state |

## 3. Accounts and roles

- Players sign up and log in with a **name and password**.
- Each player has their own trunk, decks, custom cards and asset pack.
- Roles: **player** and **admin**. The first admin account is created on first startup.

## 4. Cards

### 4.1 Card data

| Field   | Notes                                                                                     |
| ------- | ----------------------------------------------------------------------------------------- |
| Name    | Text, drawn with the owner's pack font                                                    |
| Art     | 1024 × 1434 PNG, transparent background (cutout) so the blue/red background shows through |
| Stats   | Four values — top, right, bottom, left — each 1–10, where 10 is shown as **A**            |
| Element | Optional: Fire, Ice, Thunder, Earth, Poison, Wind, Water, Holy                            |
| Stars   | **Computed, never editable** (see 4.2)                                                    |
| Type    | Generic (admin-created) or custom (player-created)                                        |
| Creator | User who made it (custom cards)                                                           |

### 4.2 Stars (card ranking)

Each stat value has a score. A card's score is the sum of its four stat scores, plus a bonus if it has an element.

**Stars = round(score / 100)** using normal rounding.

Default score table (editable in the admin panel):

| Value | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | A   |
| ----- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Score | 8   | 15  | 25  | 38  | 54  | 73  | 95  | 120 | 150 | 190 |

- **Element bonus: +10** (editable).
- Stars range **1–5** (default). A card that would round to 0 shows 1 star. A card that would round to 6 or more (score ≥ 550) **cannot be saved** in the card maker.
- Changing the score table in the admin panel recalculates the stars of every card.

Reference examples (approximate FF8 stats):

| Card       | Stats          | Score | Stars       |
| ---------- | -------------- | ----- | ----------- |
| Geezard    | 1, 4, 1, 5     | 108   | 1           |
| Malboro    | 7, 7, 4, 2     | 243   | 2           |
| Ifrit      | 9, 6, 2, 8     | 358   | 4           |
| Squall     | A, 4, 6, 9     | 451   | 5           |
| A, A, A, A | 10, 10, 10, 10 | 760   | not allowed |

### 4.3 Card sources

- **Generic cards**: created by admins, with art supplied by the owner. They make up the starter decks.
- **Custom cards**: created by players in the card maker. The creator gets **unlimited copies** in their trunk.
- There are no other sources (no packs, shop or unlocks) and **no card rewards or losses from matches**.

## 5. Trunk and decks

- Every player has a **trunk**: all the cards they own.
- **Decks are built from the trunk** in the deck editor. A player can have several decks and picks one when joining a room.
- **Deck size: exactly 20 cards.**
- **Copy limit: at most 3 cards with the same stat key** in one deck. The stat key is the exact top/right/bottom/left values **plus element**, regardless of name, art or creator. For example, two differently named cards that are both A-4-6-9 Fire share one limit of 3. A-4-6-9 and 9-A-4-6 are different keys. The limit exists to block edge cases, not to be strict.
- **Star caps per deck** (default, editable in admin panel):

| Stars | Max per deck |
| ----- | ------------ |
| 5     | 1            |
| 4     | 3            |
| 3     | 6            |
| 1–2   | unlimited    |

- An invalid deck cannot be used to join a game; the deck editor shows what breaks the rules.

### 5.1 Starter decks

- Admins define **several starter decks** made from generic cards and mark one as the default.
- A new account receives **all starter decks**: their cards go into the trunk and each starter deck appears as a ready-made deck.
- The admin's default starter deck is pre-selected as the player's active deck.
- Players can use, switch between or edit any of their decks at any time before a match.

## 6. Card maker

- Inputs: name, art upload, four stats (1–A), element (optional).
- **Live preview** of the finished card, rendered with the player's own asset pack.
- Stars update live as stats change; saving is blocked when the card exceeds 5 stars.
- Art is checked on upload (size, format) and stored in multiple sizes (full, plus smaller copies for hands and lists).
- Saved cards appear in the creator's trunk (unlimited copies) and can be added to decks.

## 7. Asset packs (card visuals)

All card visuals come from images and fonts, not from code. The game ships a **default pack**; every player can upload their own.

### 7.1 Pack contents

| File            | Size        | Notes                                                                        |
| --------------- | ----------- | ---------------------------------------------------------------------------- |
| `bg-blue.png`   | 1024 × 1434 | Card background when the card is on the blue side                            |
| `bg-red.png`    | 1024 × 1434 | Card background when the card is on the red side                             |
| `frame.png`     | 1024 × 1434 | Decorative frame; 20 px band, transparent inside. **Does not indicate team** |
| `card-back.png` | 1024 × 1434 | Back of the card                                                             |
| `digits.png`    | 800 × 80    | 10 cells of 80 × 80, in order: 1 2 3 4 5 6 7 8 9 A                           |
| `elements.png`  | 800 × 100   | 8 cells of 100 × 100: fire, ice, thunder, earth, poison, wind, water, holy   |
| `stars.png`     | 120 × 60    | 2 cells of 60 × 60: filled, empty                                            |
| Font file(s)    | .ttf / .otf | Used for the card name and other text                                        |

- Sheets use **fixed grids**: the game crops each cell by position, so no extra configuration is needed.
- The server checks image dimensions on upload and rejects packs that don't match.

### 7.2 Card layout and layering

- Card size **1024 × 1434 (5:7 portrait)**.
- All positions are defined in **`packages/card-layout/src/card-layout.json`**, the single source of truth for both the templates and the game's card renderer.
- Layers, bottom to top:
  1. Background (`bg-blue` or `bg-red`, depending on who currently controls the card)
  2. Card art
  3. Frame
  4. Stat digits, element icon, stars, name

### 7.3 Who sees which pack

- **Each card is drawn with its owner's pack on every screen.** I see my cards in my style and my opponent's cards in their style; they see the same.
- **Control is shown only by the background**: when a card is captured, its background switches between blue and red.
- **Colours are fixed per game, not per viewer**: the player who goes first is **red**, the other is **blue**, and both players see the same colours (see 9.1).

### 7.4 Templates for artists

Measurement templates are in `apps/web/public/templates/` (downloadable from the app's `/templates` page), generated by `design/tools/make_card_template.py` from the card layout file:

- `card-template-lines.png` / `card-template-labeled.png` — card art layout
- `frame-template-lines.png` / `frame-template-labeled.png` — frame
- `background-template-lines.png` / `background-template-labeled.png` — backgrounds
- `sheet-digits.png`, `sheet-elements.png`, `sheet-stars.png` — asset sheets

To change the layout: edit `card-layout.json` and rerun the script.

### 7.5 Default pack and renderer

- The default pack (placeholder art in the Balamb Classic style) lives in `apps/web/public/packs/default/` and is generated by `design/tools/make_default_pack.py` from the same layout file.
- The web renderer (`apps/web/src/components/cards/card-view.tsx`) stacks the pack images with CSS, positioned in percentages from the layout, so cards scale to any size without image processing.

## 8. Lobby and rooms (YGOPro style)

- A player **creates a room**, sets its options, and other players see it in the lobby list and join.
- **Two players per room.** Optional spectators.
- Each player picks a valid deck before the game starts.

### 8.1 Room options (set by the host before creating the room)

| Option                    | Effect                                          |
| ------------------------- | ----------------------------------------------- |
| Show cards in hand (Open) | Both players can see each other's hands         |
| Same                      | See 9.4                                         |
| Plus                      | See 9.4                                         |
| Combo                     | See 9.4                                         |
| Same Wall                 | See 9.4                                         |
| Elemental                 | **Off** / **Normal** / **All squares**. See 9.5 |
| Turn timer                | Time limit per turn                             |
| Password                  | Room requires a password to join                |
| Spectators allowed        | Others can watch                                |

## 9. Gameplay rules

### 9.1 Setup

- 3 × 3 board.
- Each player's 20-card deck is shuffled. Each player **draws 3 cards**.
- First game in a room: a **coin flip** (shown to both players) decides who goes first.
- **The first player is red**, the second is blue. Both players see the same colours.

### 9.2 Turns

- On every turn, including the first: **draw 1 card, then place 1 card** on an empty square.
- **Turn timer** (room option): **30 seconds** by default; hosts can choose 60 seconds or no timer. If time runs out, a random card from the player's hand is placed on a random empty square.
- Players alternate until all 9 squares are filled. The first player places 5 cards, the second places 4.

### 9.3 Basic capture

When a card is placed, compare each of its sides with the touching side of each adjacent card controlled by the opponent. If the placed card's number is **higher**, that card is captured (its background switches to the capturing side's colour).

### 9.4 Optional capture rules

- **Same**: if the placed card's numbers **equal** the touching numbers on **two or more** adjacent cards, those cards are captured (any of them that belong to the opponent).
- **Same Wall**: for the Same rule, board edges count as **A** (10).
- **Plus**: if the **sums** of touching number pairs are equal on **two or more** sides, those cards are captured.
- **Combo**: cards captured by Same, Same Wall or Plus then check their own neighbours using basic capture, and this chains.

### 9.5 Elemental

Room setting with three modes. At the start of each game, squares are given random elements:

| Mode        | Elemental squares  |
| ----------- | ------------------ |
| Off         | None               |
| Normal      | 0–3 random squares |
| All squares | All 9 squares      |

- Each elemental square gets a random element (Fire, Ice, Thunder, Earth, Poison, Wind, Water, Holy) and keeps it for the whole game.
- A card placed on an elemental square gets **+1 to all sides** if its element matches, and **−1 to all sides** otherwise (including cards with no element).
- The +1/−1 applies to basic and Combo comparisons. **Same and Plus use the printed numbers** (believed to match FF8; a one-line change in `packages/engine/src/capture.ts` if needed).

### 9.6 Scoring and end of game (exactly like FF8)

- The scoreboard starts at **5–5**. Each capture moves one point from one player to the other.
- When the board is full, the final score is the number of board cards each player controls, with the **second player getting +1** (this stands in for FF8's unplayed 10th card). The total is always 10.
- Higher score wins. **5–5 is a draw.**
- There is **no Sudden Death**.

### 9.7 Rematch

- After a game, both players vote **Continue** or **Leave**.
- If both vote Continue, a new game starts in the same room with the **same decks and rules**.
- **30-second timeout**: no vote counts as Leave.
- The **loser of the previous game goes first** (and is therefore red). After a draw, the turn order and colours stay the same.
- Decks cannot be changed between games; to change, leave the room.

### 9.8 Disconnects

- If a player disconnects, the game pauses (including their turn timer) and waits **2 minutes** for them to reconnect.
- If they don't return in time, the game counts as a **loss** for them and a win for the opponent.

## 10. Player rank and streaks

- Each player has a **rating (Elo-style)**, starting at **1000**, shown as a named tier:

| Tier     | Rating         |
| -------- | -------------- |
| Bronze   | below 1100     |
| Silver   | 1100–1299      |
| Gold     | 1300–1499      |
| Platinum | 1500–1699      |
| Diamond  | 1700 and above |

- Each tier except Diamond is split into **III, II and I** (e.g. Gold III → Gold II → Gold I as rating rises).
- A win raises the rating; a loss lowers it. Players also have **current win/loss streaks**.
- **Draws** change neither rating nor streaks.
- Matches have no other consequences: no cards are won or lost.

## 11. Admin panel

- **Users**: list, reset password, ban, promote to admin.
- **Generic cards**: create, edit, upload art.
- **Starter decks**: build them and choose the default.
- **Ranking**: edit the stat score table, element bonus and per-deck star caps.
- **Moderation**: remove inappropriate custom cards or asset packs (names and images).
- **Default asset pack**: upload or replace the default pack.
- **Game settings**: default room options, which options hosts may change.
- **Storage**: local folder or MinIO.

## 12. UI theme: Balamb Classic

Chosen 2026-10-15. Reference mockup: `design/themes/theme-balamb.html` (the other files in `design/themes/` are rejected alternatives).
Inspired by FF8's menus. The theme styles the app around the cards; the cards themselves come from asset packs (section 7).

| Token            | Value                                                                                  | Used for                           |
| ---------------- | -------------------------------------------------------------------------------------- | ---------------------------------- |
| Page background  | `#0a0f1f`, radial glow `#22315a` at the top                                            | Body                               |
| Window           | Gradient `#56688f` → `#1f2840`, 2 px border `#d6deef` (75%), dark outer ring `#0a0f1f` | Panels, dialogs                    |
| Header bar       | Gradient `#4c5c80` → `#26304b`, bottom border `#d6deef`                                | Top navigation                     |
| Cream accent     | `#f4ecd2`                                                                              | Headings, logo, timer, focus rings |
| Primary button   | Gradient `#fbf3d6` → `#c9b27a`, text `#1b2340`                                         | Main actions                       |
| Secondary button | Dark translucent fill, `#d6deef` border                                                | Secondary actions                  |
| Action blue      | `#3a6fd8`                                                                              | "Your turn", toggles               |
| Board            | Wood gradient `#5a4630` → `#2b2117`, border `#9c8458`                                  | Game board                         |
| Score colours    | Blue `#8fb5ff`, red `#ff9aa2`                                                          | Score numbers                      |
| Status           | In game `#c2424f`, waiting `#3a8f5a`                                                   | Lobby status tags                  |
| Fonts            | **Cinzel** (headings, logo, numbers), **Exo 2** (body)                                 |                                    |

- Fonts are bundled with the app (e.g. via `next/font`), not loaded from Google at runtime, so the game works without outside requests.
- The mockup's blue/red card gradients can serve as the default asset pack's `bg-blue.png` / `bg-red.png` until real art exists.

## 13. Data model (outline)

| Table                              | Contents                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| users                              | name, password hash, role, rating, streaks, banned flag, selected asset pack |
| cards                              | name, art path, stats ×4, element, stars, type (generic/custom), creator     |
| trunk_entries                      | user, card, count (unlimited for own custom cards)                           |
| decks / deck_cards                 | user's decks and the 20 cards in each                                        |
| starter_decks / starter_deck_cards | admin-defined starter decks, default flag                                    |
| asset_packs                        | owner, file paths, font paths                                                |
| rooms                              | host, options, password hash, state                                          |
| matches                            | players, decks, winner/draw, final score, move log, timestamps               |
| settings                           | score table, element bonus, star caps, default room options                  |

## 14. Out of scope for now

- Trade rule and any card rewards or card losses from matches.
- Cards changing visual style when they change owner.
- Sudden Death.
- "5 cards at start" hand rule.
- Card packs, shop or other ways to get cards.

## 15. Open details (to settle before or during build)

None at the moment.
