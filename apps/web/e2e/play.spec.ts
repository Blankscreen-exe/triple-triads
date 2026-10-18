import { expect, test, type Browser, type Page } from '@playwright/test';
import { signUp, uniqueUsername } from './helpers';

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
  await page.goto('/play');
  const row = page.getByRole('listitem').filter({ hasText: roomName });
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
  }).toPass({ timeout: 5000 });
  if (!active) throw new Error('unreachable');

  // Cards in a hand overlap; the last one is on top and fully clickable.
  await active.getByRole('list', { name: 'Your hand' }).getByRole('button').last().click();
  await active
    .getByRole('button', { name: /^Place card on row/ })
    .first()
    .click();
  await expect(active.getByText(YOUR_TURN)).toBeHidden();
}

test('two players play a full game and agree to a rematch', async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const roomName = `Duel ${alice.name}`;

  await createRoom(alice.page, roomName);
  await joinFromLobby(bob.page, roomName, 'Join');

  for (const { page } of [alice, bob]) {
    await expect(page.getByRole('status').filter({ hasText: /turn/ })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Your hand' }).getByRole('button')).not.toHaveCount(
      0,
    );
  }

  for (let turn = 0; turn < 9; turn++) await playTurn([alice.page, bob.page]);

  const outcomes = ['Victory', 'Defeat', 'Draw'];
  for (const { page } of [alice, bob]) {
    await expect(
      page.getByRole('heading', { name: new RegExp(`^(${outcomes.join('|')})$`) }),
    ).toBeVisible();
    // The game was recorded and the rating change is shown.
    await expect(page.getByText(/^Rating \d+/)).toBeVisible();
  }

  await alice.page.goto('/rankings');
  await expect(alice.page.getByRole('cell', { name: alice.name, exact: true })).toBeVisible();
  await expect(alice.page.getByRole('cell', { name: bob.name, exact: true })).toBeVisible();
  await alice.page.goBack();

  await alice.page.getByRole('button', { name: 'Play again' }).click();
  await expect(alice.page.getByText('Waiting for your opponent…')).toBeVisible();
  await bob.page.getByRole('button', { name: 'Play again' }).click();

  for (const { page } of [alice, bob]) {
    await expect(
      page.getByRole('heading', { name: new RegExp(`^(${outcomes.join('|')})$`) }),
    ).toBeHidden();
    await expect(page.getByRole('list', { name: 'Board' }).getByRole('img')).toHaveCount(0);
  }
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

  await watcher.page.goto('/play');
  await createRoom(host.page, roomName);

  await expect(watcher.page.getByRole('listitem').filter({ hasText: roomName })).toBeVisible();
});

test('the host picks their colour and the coin flip picks who starts', async ({ browser }) => {
  const host = await newPlayer(browser);
  const guest = await newPlayer(browser);
  const roomName = `Colours ${host.name}`;

  await createRoom(host.page, roomName, 'Blue');
  await guest.page.goto('/play');
  await expect(guest.page.getByRole('listitem').filter({ hasText: roomName })).toContainText(
    'you play red',
  );
  await joinFromLobby(guest.page, roomName, 'Join');

  for (const { page } of [host, guest]) {
    await expect(page.getByRole('group', { name: `${host.name} (blue)` })).toBeVisible();
    await expect(page.getByRole('group', { name: `${guest.name} (red)` })).toBeVisible();
    await expect(page.getByRole('status')).toContainText(
      new RegExp(`Coin flip: (${host.name}|${guest.name}) goes first`),
    );
  }
});
