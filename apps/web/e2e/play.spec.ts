import { expect, test, type Browser, type Page } from '@playwright/test';
import { findRoom, signUp, uniqueUsername } from './helpers';

const YOUR_TURN = 'Your turn: choose a card';

async function newPlayer(browser: Browser): Promise<{ page: Page; name: string }> {
  const page = await (await browser.newContext()).newPage();
  const name = uniqueUsername();
  await signUp(page, name);
  return { page, name };
}

async function createRoom(page: Page, roomName: string, color: 'Red' | 'Blue' = 'Red') {
  await page.goto('/play');
  await page.getByLabel('Room name').fill(roomName);
  // The radio buttons are visually hidden behind styled labels, so click the label like a user.
  const colours = page.getByRole('group', { name: 'Your colour' });
  await colours.getByText(color, { exact: true }).click();
  await expect(colours.getByRole('radio', { name: color })).toBeChecked();
  await page.getByLabel('Turn timer').selectOption('null');
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByText('Waiting for an opponent…')).toBeVisible();
}

async function joinFromLobby(page: Page, roomName: string, action: 'Join' | 'Watch') {
  const row = await findRoom(page, roomName);
  await row.getByRole('button', { name: action }).click();
  await expect(page.getByRole('heading', { name: roomName })).toBeVisible();
}

/** Plays one turn on whichever page currently shows "Your turn". */
async function playTurn(pages: readonly Page[]) {
  let active: Page | undefined;
  await expect(async () => {
    for (const page of pages) {
      if (await page.getByText(YOUR_TURN).isVisible()) {
        active = page;
        return;
      }
    }
    throw new Error('Nobody has the turn yet');
  }).toPass({ timeout: 15_000 });
  if (!active) throw new Error('unreachable');

  // Cards in a hand overlap; the last one is on top and fully clickable.
  await active.getByRole('list', { name: 'Your hand' }).getByRole('button').last().click();
  await active.getByRole('menuitem', { name: 'Use' }).click();
  await active
    .getByRole('button', { name: /^Place card on row/ })
    .first()
    .click();
  await expect(active.getByText(YOUR_TURN)).toBeHidden();
}

const RESULT_HEADING = /^(Victory|Defeat|Draw)$/;

/** Two new players play a whole best-of-3 match in a new room, up to the result screen. */
async function playFullMatch(browser: Browser, roomPrefix: string) {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const roomName = `${roomPrefix} ${alice.name}`;

  await createRoom(alice.page, roomName);
  await joinFromLobby(bob.page, roomName, 'Join');

  for (const { page } of [alice, bob]) {
    await expect(page.getByRole('status').filter({ hasText: /turn/ })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Your hand' }).getByRole('button')).not.toHaveCount(
      0,
    );
  }

  // Every round is played: 27 turns plus the breaks between rounds.
  for (let turn = 0; turn < 27; turn++) await playTurn([alice.page, bob.page]);

  for (const { page } of [alice, bob]) {
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeVisible();
  }
  return { alice, bob };
}

test('two players play a full match and agree to a rematch', async ({ browser }) => {
  test.setTimeout(180_000);
  const { alice, bob } = await playFullMatch(browser, 'Duel');

  for (const { page } of [alice, bob]) {
    // The game was recorded and the rating change is shown.
    await expect(page.getByText(/^Rating \d+/)).toBeVisible();
  }

  const room = alice.page.url();
  await alice.page.goto('/rankings');
  // Other tests' players may push Alice past the first page: her position links to hers.
  await expect(alice.page.getByText(/^You are #\d+/)).toBeVisible();
  const showMine = alice.page.getByRole('link', { name: 'Show my page' });
  if (await showMine.isVisible()) await showMine.click();
  await expect(
    alice.page.locator('tr[aria-current="true"]').getByRole('cell', { name: alice.name }),
  ).toBeVisible();
  // The game is at the top of her match history.
  await alice.page.goto('/profile/matches');
  await expect(alice.page.getByRole('table', { name: /^Games 1–1 of 1$/ })).toBeVisible();
  await expect(alice.page.getByRole('row').nth(1)).toContainText(bob.name);
  await alice.page.goto(room);

  await alice.page.getByRole('button', { name: 'Play again' }).click();
  await expect(alice.page.getByText('Waiting for your opponent…')).toBeVisible();
  // Bob is asked to accept Alice's rematch request.
  await expect(bob.page.getByText(`${alice.name} wants to play again!`)).toBeVisible();
  await bob.page.getByRole('button', { name: 'Accept' }).click();

  for (const { page } of [alice, bob]) {
    await expect(page.getByRole('heading', { name: RESULT_HEADING })).toBeHidden();
    await expect(
      page.getByRole('list', { name: 'Board' }).getByRole('img', { name: /, \d stars?, top / }),
    ).toHaveCount(0);
  }
});

test('declining a rematch closes the room and sends both players to the lobby', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const { alice, bob } = await playFullMatch(browser, 'Declined');

  await alice.page.getByRole('button', { name: 'Play again' }).click();
  await expect(alice.page.getByText('Waiting for your opponent…')).toBeVisible();
  // Waiting for an answer is not a dead end either.
  await expect(alice.page.getByRole('button', { name: 'Leave', exact: true })).toBeVisible();

  await bob.page.getByRole('button', { name: 'Decline' }).click();
  await expect(bob.page).toHaveURL(/\/play$/);

  await expect(alice.page).toHaveURL(/\/play$/);
  await expect(alice.page.getByLabel('Notifications')).toContainText(`${bob.name} left the room`);
  await expect(bob.page.getByLabel('Notifications')).toBeEmpty();
});

test('a spectator watches without seeing either hand', async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const carol = await newPlayer(browser);
  const roomName = `Watch ${alice.name}`;

  await createRoom(alice.page, roomName);
  await joinFromLobby(bob.page, roomName, 'Join');
  await joinFromLobby(carol.page, roomName, 'Watch');

  await expect(carol.page.getByRole('button', { name: 'Stop watching' })).toBeVisible();
  await expect(carol.page.getByRole('list', { name: 'Your hand' })).toHaveCount(0);
  await expect(carol.page.getByRole('list', { name: /hidden cards/ })).toHaveCount(2);
  await expect(alice.page.getByText('1 watching')).toBeVisible();
});

test('the lobby updates live when a room is created', async ({ browser }) => {
  const watcher = await newPlayer(browser);
  const host = await newPlayer(browser);
  const roomName = `Live ${host.name}`;

  const row = await findRoom(watcher.page, roomName);
  await createRoom(host.page, roomName);

  await expect(row).toBeVisible();
});

test('the host picks their colour and the coin flip picks who starts', async ({ browser }) => {
  const host = await newPlayer(browser);
  const guest = await newPlayer(browser);
  const roomName = `Colours ${host.name}`;

  await createRoom(host.page, roomName, 'Blue');
  await expect(await findRoom(guest.page, roomName)).toContainText('you play red');
  await joinFromLobby(guest.page, roomName, 'Join');

  for (const { page } of [host, guest]) {
    await expect(page.getByRole('group', { name: `${host.name} (blue)` })).toBeVisible();
    await expect(page.getByRole('group', { name: `${guest.name} (red)` })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      new RegExp(`Coin flip: (${host.name}|${guest.name}) goes first`),
    );
  }
});

/** Starts a game between two new players; `page` is the one whose turn it is. */
async function gameOnYourTurn(
  browser: Browser,
  roomPrefix: string,
): Promise<{ page: Page; other: Page }> {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const roomName = `${roomPrefix} ${alice.name}`;
  await createRoom(alice.page, roomName);
  await joinFromLobby(bob.page, roomName, 'Join');

  let active: Page | undefined;
  await expect(async () => {
    for (const { page } of [alice, bob]) {
      if (await page.getByText(YOUR_TURN).isVisible()) active = page;
    }
    expect(active).toBeDefined();
  }).toPass({ timeout: 15_000 });
  if (!active) throw new Error('unreachable');
  return { page: active, other: active === alice.page ? bob.page : alice.page };
}

/** Presses on the top card of the hand and moves it over a board square, without letting go. */
async function dragCardOver(page: Page, position: number) {
  const card = page.getByRole('list', { name: 'Your hand' }).getByRole('button').last();
  const square = page.locator(`[data-drop-position="${String(position)}"]`);
  const from = await card.boundingBox();
  const to = await square.boundingBox();
  if (!from || !to) throw new Error('card or square not on screen');

  await page.mouse.move(from.x + from.width / 2, from.y + 20);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  return square;
}

test('a card can be dragged from the hand onto the board', async ({ browser }) => {
  const { page } = await gameOnYourTurn(browser, 'Drag');

  const square = await dragCardOver(page, 4);
  await page.mouse.up();

  const board = page.getByRole('list', { name: 'Board' });
  await expect(board.getByRole('img', { name: /, \d stars?, top / })).toHaveCount(1);
  await expect(page.getByText(YOUR_TURN)).toBeHidden();
  await expect(square).toHaveCount(0); // the centre square is taken now
});

test('pressing Escape cancels a drag', async ({ browser }) => {
  const { page } = await gameOnYourTurn(browser, 'Cancel');

  await dragCardOver(page, 4);
  await page.keyboard.press('Escape');
  await page.mouse.up();

  await expect(
    page.getByRole('list', { name: 'Board' }).getByRole('img', { name: /, \d stars?, top / }),
  ).toHaveCount(0);
  await expect(page.getByText(YOUR_TURN)).toBeVisible();
});

test('tapping a card offers Preview and Use; Use then a square plays it', async ({ browser }) => {
  const { page } = await gameOnYourTurn(browser, 'Menu');
  const card = page.getByRole('list', { name: 'Your hand' }).getByRole('button').last();
  const cardName = (await card.getByRole('img').getAttribute('aria-label'))?.split(',')[0] ?? '';

  await card.click();
  await page.getByRole('menuitem', { name: 'Preview' }).click();
  const preview = page.getByRole('dialog', { name: `Preview: ${cardName}` });
  await expect(preview.getByRole('img', { name: new RegExp(`^${cardName}, `) })).toBeVisible();
  await preview.getByRole('button', { name: 'Close' }).click();
  await expect(preview).toBeHidden();
  await expect(page.getByText(YOUR_TURN)).toBeVisible();

  // Escape closes the menu without choosing anything.
  await card.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();

  await card.click();
  await page.getByRole('menuitem', { name: 'Use' }).click();
  await expect(page.getByText('Choose a square')).toBeVisible();
  await page.getByRole('button', { name: 'Place card on row 2, column 2' }).click();

  await expect(
    page
      .getByRole('list', { name: 'Board' })
      .getByRole('img', { name: new RegExp(`^${cardName}, `) }),
  ).toBeVisible();
  await expect(page.getByText(YOUR_TURN)).toBeHidden();
});

test('cards can be previewed while waiting, but only used on your turn', async ({ browser }) => {
  const { other } = await gameOnYourTurn(browser, 'Wait');
  const card = other.getByRole('list', { name: 'Your hand' }).getByRole('button').last();

  await card.click();
  await expect(other.getByRole('menuitem', { name: /^Use/ })).toBeDisabled();
  await other.getByRole('menuitem', { name: 'Preview' }).click();
  const preview = other.getByRole('dialog', { name: /^Preview: / });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Use' })).toHaveCount(0);
});

test('when a player surrenders, the other is sent to the lobby and the room is gone', async ({
  browser,
}) => {
  const host = await newPlayer(browser);
  const guest = await newPlayer(browser);
  const roomName = `Surrender ${host.name}`;
  await createRoom(host.page, roomName);
  await joinFromLobby(guest.page, roomName, 'Join');
  await expect(guest.page.getByRole('status').filter({ hasText: /turn/ })).toBeVisible();

  host.page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('You lose this match');
    void dialog.accept();
  });
  await host.page.getByRole('button', { name: 'Surrender' }).click();

  for (const page of [host.page, guest.page]) {
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByRole('listitem').filter({ hasText: roomName })).toHaveCount(0);
  }
  const notifications = guest.page.getByLabel('Notifications');
  await expect(notifications).toHaveText(`${host.name} left the room×`);
  // The player who left is not told about it.
  await expect(host.page.getByLabel('Notifications')).toBeEmpty();
});

test('when a player disconnects, the game waits for them to come back', async ({ browser }) => {
  const host = await newPlayer(browser);
  const guest = await newPlayer(browser);
  const roomName = `Away ${host.name}`;
  await createRoom(host.page, roomName);
  await joinFromLobby(guest.page, roomName, 'Join');
  await expect(guest.page.getByRole('status').filter({ hasText: /turn/ })).toBeVisible();
  const roomUrl = host.page.url();

  await host.page.goto('about:blank');

  await expect(guest.page.getByRole('status')).toContainText(`${host.name} disconnected`);
  await expect(guest.page).toHaveURL(roomUrl);

  await host.page.goto(roomUrl);
  await expect(guest.page.getByRole('status').filter({ hasText: /turn/ })).toBeVisible();
  await expect(host.page.getByRole('heading', { name: roomName })).toBeVisible();
});
