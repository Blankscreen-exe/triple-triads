import { expect, test, type Browser, type Page } from '@playwright/test';
import { signUp, uniqueUsername } from './helpers';

const YOUR_TURN = 'Your turn: choose a card';
/** Long enough for the break between rounds (ROUND_BREAK_MS) plus some slack. */
const NEXT_ROUND_TIMEOUT = 15_000;
/** Seven cards with 5 on every side; elements only matter on elemental squares (off here). */
const STALEMATE_ELEMENTS = ['', 'fire', 'ice', 'thunder', 'earth', 'poison', 'wind'] as const;

/**
 * Signs up a player whose active deck is twenty 5-5-5-5 cards. With Same, Plus and Combo off,
 * 5 never beats 5, so every round between two such players ends 5–5.
 */
async function stalematePlayer(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signUp(page, uniqueUsername());

  for (const [index, element] of STALEMATE_ELEMENTS.entries()) {
    await page.goto('/cards/new');
    await page.getByLabel('Name', { exact: true }).fill(`Stone ${String(index + 1)}`);
    // The live preview shows the name once the form is interactive; saving before that would
    // submit the plain HTML form and reload the page.
    await expect(
      page.getByRole('img', { name: new RegExp(`^Stone ${String(index + 1)},`) }),
    ).toBeVisible();
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      await page.getByLabel(side, { exact: true }).selectOption('5');
    }
    await page.getByLabel('Element', { exact: true }).selectOption(element);
    await page.getByRole('button', { name: 'Save card' }).click();
    await expect(page).toHaveURL('/cards');
  }

  await page.goto('/decks');
  await page.getByLabel('New deck name').fill('Stalemate');
  await page.getByRole('button', { name: 'New deck' }).click();
  const trunk = page.getByRole('region', { name: 'Your trunk' });
  // Copy limit: 3 per stats-and-element, so 3 × 6 + 2.
  for (const [index] of STALEMATE_ELEMENTS.entries()) {
    const copies = index < 6 ? 3 : 2;
    for (let copy = 0; copy < copies; copy++) {
      await trunk.getByRole('button', { name: `Add Stone ${String(index + 1)}` }).click();
    }
  }
  const deck = page.getByRole('region', { name: 'Deck' });
  await expect(deck).toContainText('20 / 20 cards');
  await expect(deck).toContainText('This deck follows the deck rules.');
  await deck.getByRole('button', { name: 'Save deck' }).click();
  await expect(page.getByText('Deck saved.')).toBeVisible();

  await page.goto('/decks');
  await page
    .getByRole('listitem', { name: 'Stalemate' })
    .getByRole('button', { name: 'Make active' })
    .click();
  await expect(
    page.getByRole('listitem', { name: 'Stalemate' }).getByText('Active', { exact: true }),
  ).toBeVisible();
  return page;
}

/** Plays one turn on whichever page has the turn. */
async function playTurn(pages: readonly Page[]) {
  let active: Page | undefined;
  await expect(async () => {
    for (const page of pages) if (await page.getByText(YOUR_TURN).isVisible()) active = page;
    expect(active).toBeDefined();
  }).toPass({ timeout: 10_000 });
  if (!active) throw new Error('unreachable');
  await active.getByRole('list', { name: 'Your hand' }).getByRole('button').last().click();
  await active
    .getByRole('button', { name: /^Place card on row/ })
    .first()
    .click();
  await expect(active.getByText(YOUR_TURN)).toBeHidden();
}

test('a drawn round is followed by another until the decks run out', async ({ browser }) => {
  test.setTimeout(180_000);
  const host = await stalematePlayer(browser);
  const guest = await stalematePlayer(browser);
  const roomName = `Rounds ${uniqueUsername()}`;

  await host.goto('/play');
  await host.getByLabel('Room name').fill(roomName);
  await host.getByLabel('Turn timer').selectOption('null');
  await expect(host.getByLabel('Match')).toHaveValue('until-winner');
  const form = host.locator('form').filter({ has: host.getByLabel('Room name') });
  // A toggle's name is its label followed by its hint ("Same Wall" also starts with "Same").
  for (const [rule, hint] of [
    ['Same', 'Equal numbers'],
    ['Plus', 'Equal sums'],
    ['Combo', 'Same/Plus captures'],
  ] as const) {
    const toggle = form.getByRole('checkbox', { name: `${rule} ${hint}`, exact: false });
    // Toggles are visually hidden checkboxes inside their labels: click the label.
    if (await toggle.isChecked()) await form.getByText(rule, { exact: true }).click();
    await expect(toggle).not.toBeChecked();
  }
  await host.getByRole('button', { name: 'Create room' }).click();
  await expect(host.getByText('Waiting for an opponent…')).toBeVisible();

  await guest.goto('/play');
  await guest
    .getByRole('listitem')
    .filter({ hasText: roomName })
    .getByRole('button', { name: 'Join' })
    .click();

  for (let round = 1; round <= 3; round++) {
    for (const page of [host, guest]) {
      await expect(page.getByText(`Round ${String(round)}`, { exact: true })).toBeVisible({
        timeout: NEXT_ROUND_TIMEOUT,
      });
    }
    if (round > 1) {
      await expect(host.getByRole('status')).toContainText(`The last round was a draw, so`);
    }
    for (let turn = 0; turn < 9; turn++) await playTurn([host, guest]);

    if (round < 3) {
      for (const page of [host, guest]) {
        await expect(
          page.getByRole('heading', { name: `Round ${String(round)}: draw` }),
        ).toBeVisible();
        await expect(page.getByText(`Round ${String(round + 1)} starts in`)).toBeVisible();
      }
    }
  }

  // Three drawn rounds use up the decks: the match is a draw, and only now can they play again.
  for (const page of [host, guest]) {
    await expect(page.getByRole('heading', { name: 'Draw', exact: true })).toBeVisible();
    await expect(page.getByText('All 3 rounds drawn')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  }
});
