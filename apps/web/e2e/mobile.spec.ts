import { expect, test, type Browser } from '@playwright/test';
import { signUp, uniqueUsername } from './helpers';

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

test('on a phone, the game fills the screen without scrolling', async ({ browser }) => {
  const host = await newPhonePlayer(browser);
  const guest = await newPhonePlayer(browser);
  const roomName = `Phone ${host.name}`;

  await host.page.goto('/play');
  await host.page.getByRole('tab', { name: 'Create room' }).click();
  await host.page.getByLabel('Room name').fill(roomName);
  await host.page.getByRole('button', { name: 'Create room' }).click();
  await expect(host.page.getByText('Waiting for an opponent…')).toBeVisible();
  await guest.page.goto('/play');
  await guest.page
    .getByRole('listitem')
    .filter({ hasText: roomName })
    .getByRole('button', { name: 'Join' })
    .click();

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
