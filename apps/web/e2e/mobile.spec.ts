import { expect, test, type Browser } from '@playwright/test';
import { findRoom, signUp, uniqueUsername } from './helpers';

const PHONE = { viewport: { width: 390, height: 750 }, isMobile: true, hasTouch: true };

async function newPhonePlayer(browser: Browser) {
  const page = await (await browser.newContext(PHONE)).newPage();
  const name = uniqueUsername();
  await signUp(page, name);
  return { page, name };
}

test('on a phone, the main links are in a menu', async ({ browser }) => {
  const { page } = await newPhonePlayer(browser);

  const header = page.getByRole('banner');
  const menu = header.getByRole('button', { name: 'Menu' });
  await expect(header.getByRole('link', { name: 'Decks', exact: true })).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await header.getByRole('link', { name: 'Decks', exact: true }).click();

  await expect(page).toHaveURL(/\/decks$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('on a phone, the lobby has Join and Create tabs, and filters behind a button', async ({
  browser,
}) => {
  const { page } = await newPhonePlayer(browser);
  await page.goto('/play');

  const join = page.getByRole('tab', { name: /^Join/ });
  const create = page.getByRole('tab', { name: 'Create room' });
  await expect(join).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Room name')).toBeHidden();

  // Only the search box shows until the filter button is pressed.
  const filters = page.getByRole('search', { name: 'Filter rooms' });
  await expect(filters.getByLabel('Search')).toBeVisible();
  await expect(filters.getByLabel('Timer')).toBeHidden();
  await filters.getByRole('button', { name: 'Filters' }).click();
  await filters.getByLabel('Timer').selectOption('30');
  await expect(filters.getByRole('button', { name: 'Filters (1 on)' })).toBeVisible();

  await create.click();
  await expect(create).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('Room name')).toBeVisible();
  await expect(filters).toBeHidden();
});

test('on a phone, the card maker has Attributes and Preview tabs, and Save on both', async ({
  browser,
}) => {
  const { page } = await newPhonePlayer(browser);
  await page.goto('/cards/new');
  const name = page.getByLabel('Name', { exact: true });
  const save = page.getByRole('button', { name: 'Save card' });

  // Saving with no name from the Preview tab brings the fields back to fix it.
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(name).toBeHidden();
  await save.click();
  await expect(page.getByRole('tab', { name: 'Attributes' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  await name.fill('Pocket Moogle');
  await page.getByRole('tab', { name: 'Preview' }).click();
  await expect(page.getByRole('img', { name: /^Pocket Moogle, / })).toBeVisible();
  await expect(save).toBeInViewport();
  await save.click();
  await expect(page).toHaveURL('/cards');
});

test('on a phone, the deck list fills the screen and pages instead of scrolling', async ({
  browser,
}) => {
  const { page } = await newPhonePlayer(browser);
  // Four starter decks plus six new ones: more than fit on one phone screen.
  for (const name of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
    await page.goto('/decks');
    await page.getByRole('button', { name: '+ New' }).click();
    const dialog = page.getByRole('dialog', { name: 'New deck' });
    await dialog.getByLabel('New deck name').fill(name);
    await dialog.getByRole('button', { name: 'New deck' }).click();
    await expect(page).toHaveURL(/\/decks\/[\w-]+$/);
  }

  await page.goto('/decks');
  const decks = page.getByRole('list', { name: 'Decks' });
  const pages = page.getByRole('navigation', { name: 'Decks pages' });
  await expect(pages).toContainText(/Page 1 of \d/);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    PHONE.viewport.height,
  );
  const firstPage = await decks.getByRole('heading').allTextContents();

  await pages.getByRole('button', { name: 'Next page' }).click();
  await expect(pages).toContainText('Page 2 of');
  const secondPage = await decks.getByRole('heading').allTextContents();
  expect(firstPage.length + secondPage.length).toBeLessThanOrEqual(10);
  expect(secondPage.some((name) => firstPage.includes(name))).toBe(false);

  // Details and actions are behind each row's ⋯ button.
  const name = secondPage[0] ?? '';
  await decks.getByRole('button', { name: `More about ${name}` }).click();
  const sheet = page.getByRole('dialog', { name });
  await expect(sheet.getByText('With an element')).toBeVisible();
  await expect(sheet.getByRole('link', { name: 'Edit' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
});

test('on a phone, the trunk pages three columns of cards, with filters behind a button', async ({
  browser,
}) => {
  const { page } = await newPhonePlayer(browser);
  await page.goto('/trunk');
  const filters = page.getByRole('search', { name: 'Filter cards' });
  await expect(filters).toContainText('55 cards');

  const cards = page.getByRole('list', { name: 'Cards' }).getByRole('listitem');
  const pages = page.getByRole('navigation', { name: 'Cards pages' });
  // Four rows of three.
  await expect(cards).toHaveCount(12);
  await pages.getByRole('button', { name: 'Next page' }).click();
  await expect(pages).toContainText('Page 2 of 5');
  await expect(cards).toHaveCount(12);
  for (const next of [3, 4, 5]) {
    await pages.getByRole('button', { name: 'Next page' }).click();
    await expect(pages).toContainText(`Page ${String(next)} of 5`);
  }
  await expect(cards).toHaveCount(7);

  await expect(filters.getByLabel('Stars')).toBeHidden();
  await filters.getByRole('button', { name: 'Filters' }).click();
  await filters.getByLabel('Stars').selectOption('1');
  await expect(filters.getByRole('button', { name: 'Filters (1 on)' })).toBeVisible();
  // A new filter starts again from the first page.
  await expect(pages).toBeHidden();
});

test('on a phone, the deck editor has Deck and Trunk tabs, and Save stays on screen', async ({
  browser,
}) => {
  const { page } = await newPhonePlayer(browser);
  await page.goto('/decks');
  // Opened from a deck's sheet, which must not stay open over the editor.
  await page.getByRole('button', { name: 'More about Vanguard' }).click();
  await page.getByRole('dialog', { name: 'Vanguard' }).getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit deck' })).toBeVisible();

  const deck = page.getByRole('region', { name: 'Deck', exact: true });
  const trunk = page.getByRole('region', { name: 'Your trunk' });
  await expect(page.getByRole('tab', { name: /^Deck/ })).toHaveText('Deck20/20');
  await expect(trunk).toBeHidden();
  await deck.getByRole('button', { name: 'Remove one Sky Wyrm' }).click();
  await expect(page.getByRole('tab', { name: /^Deck/ })).toHaveText('Deck19/20');

  await page.getByRole('tab', { name: 'Trunk' }).click();
  await expect(deck).toBeHidden();
  const cards = trunk.getByRole('list', { name: 'Trunk cards' }).getByRole('button');
  await expect(cards).toHaveCount(12);
  await trunk.getByRole('button', { name: 'Next page' }).click();
  await expect(cards).toHaveCount(12);

  await trunk.getByLabel('Search').fill('Sky Wyrm');
  await trunk.getByRole('button', { name: 'Add Sky Wyrm' }).click();
  await expect(page.getByRole('tab', { name: /^Deck/ })).toHaveText('Deck20/20');
  const save = page.getByRole('button', { name: 'Save deck' });
  await expect(save).toBeInViewport();
  await save.click();
  await expect(page.getByText('Deck saved.')).toBeVisible();
});

test('on a phone, the game fills the screen without scrolling', async ({ browser }) => {
  const host = await newPhonePlayer(browser);
  const guest = await newPhonePlayer(browser);
  const roomName = `Phone ${host.name}`;

  await host.page.goto('/play');
  await host.page.getByRole('tab', { name: 'Create room' }).click();
  await host.page.getByLabel('Room name').fill(roomName);
  await host.page.getByRole('button', { name: 'Create room' }).click();
  await expect(host.page.getByText('Waiting for an opponent…')).toBeVisible();
  await (await findRoom(guest.page, roomName)).getByRole('button', { name: 'Join' }).click();

  const page = host.page;
  const hand = page.getByRole('list', { name: 'Your hand' }).getByRole('button');
  await expect(hand).not.toHaveCount(0);
  // Nothing sticks out, so the page never scrolls, sideways or down.
  expect(
    await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]),
  ).toEqual([PHONE.viewport.width, PHONE.viewport.height]);

  const board = await page.getByRole('list', { name: 'Board' }).boundingBox();
  const [first, second] = [await hand.nth(0).boundingBox(), await hand.nth(1).boundingBox()];
  if (!board || !first || !second) throw new Error('The board and hand should be on the page');
  // The hand is laid out side by side, below the board.
  expect(second.x).toBeGreaterThan(first.x);
  expect(second.y).toBe(first.y);
  expect(first.y).toBeGreaterThan(board.y + board.height);
  expect(first.y + first.height).toBeLessThanOrEqual(PHONE.viewport.height);

  // Everything else is behind buttons: the full scoreboard behind More, the room behind the menu.
  const score = page.getByRole('group', { name: 'Score' });
  await expect(score).toContainText('Round 1 of 3');
  await score.getByRole('button', { name: 'More' }).click();
  const scoreboard = page.getByRole('dialog', { name: 'Scoreboard' });
  await expect(scoreboard.getByText('Cards captured')).toBeVisible();
  await scoreboard.getByRole('button', { name: 'Close' }).click();
  await expect(scoreboard).toBeHidden();

  await page.getByRole('button', { name: 'Game menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Game menu' });
  await expect(menu.getByRole('heading', { name: roomName })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Surrender' })).toBeVisible();
  await menu.getByRole('button', { name: 'Back to the game' }).click();
  await expect(menu).toBeHidden();
});
