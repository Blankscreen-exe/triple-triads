import { expect, test } from '@playwright/test';

test('the rules are public and linked from the header', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Rules' }).click();

  await expect(page.getByRole('heading', { name: 'How to play', level: 1 })).toBeVisible();
  for (const section of ['Cards', 'Decks', 'Playing a game', 'Room rules', 'Winning', 'Rating']) {
    await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible();
  }
});

test('the rules show this server’s current settings', async ({ page }) => {
  await page.goto('/rules');

  const decks = page.getByRole('region', { name: 'Decks' });
  await expect(decks).toContainText('exactly 20 cards');
  await expect(decks).toContainText(
    '5★ at most 1, 4★ at most 3, 3★ at most 6; 1★ and 2★ unlimited.',
  );

  const cards = page.getByRole('region', { name: 'Cards' });
  await expect(cards).toContainText('is worth 461 points, so it has 5 stars');
  await expect(cards.getByRole('img', { name: /^Sky Wyrm,/ })).toBeVisible();

  const rules = page.getByRole('region', { name: 'Room rules' });
  await expect(rules.getByRole('term').filter({ hasText: 'Same Wall' })).toContainText(
    /by default|on this server/i,
  );
});

test('the table of contents jumps to each section', async ({ page }) => {
  await page.goto('/rules');

  await page
    .getByRole('navigation', { name: 'On this page' })
    .getByRole('link', { name: 'Winning' })
    .click();

  await expect(page).toHaveURL(/#winning$/);
  await expect(page.getByRole('region', { name: 'Winning' })).toBeInViewport();
});
