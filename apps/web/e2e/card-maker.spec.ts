import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { signUp, uniqueUsername } from './helpers';

async function artFile() {
  const buffer = await sharp({
    create: {
      width: 600,
      height: 840,
      channels: 4,
      background: { r: 90, g: 160, b: 220, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return { name: 'moogle.png', mimeType: 'image/png', buffer };
}

test('a player makes a card with art and it appears in their collection', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/cards/new');

  await page.getByLabel('Name', { exact: true }).fill('Garden Moogle');
  await page.getByLabel('Top', { exact: true }).selectOption('8');
  await page.getByLabel('Right', { exact: true }).selectOption('3');
  await page.getByLabel('Bottom', { exact: true }).selectOption('6');
  await page.getByLabel('Left', { exact: true }).selectOption('2');
  await page.getByLabel('Element', { exact: true }).selectOption('holy');
  await page.getByLabel('Art').setInputFiles(await artFile());
  // Choosing art opens the crop dialog; keep the default crop.
  await expect(page.getByRole('heading', { name: 'Crop art' })).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('heading', { name: 'Crop art' })).toBeHidden();

  // 120 + 25 + 73 + 15 + 10 (element) = 243 → 2 stars.
  await expect(page.getByText('Score 243 · 2 stars')).toBeVisible();
  await page.getByRole('button', { name: 'Save card' }).click();

  await expect(page).toHaveURL('/cards');
  const card = page.getByRole('img', { name: /^Garden Moogle, 2 stars, top 8, right 3/ });
  await expect(card).toBeVisible();

  const artLayer = card.locator('[style*="/media/cards/"]');
  const artUrl = (await artLayer.getAttribute('style'))?.match(/url\("([^"]+)"\)/)?.[1];
  expect(artUrl).toMatch(/^\/media\/cards\/.+-card\.webp$/);
  const response = await page.request.get(artUrl ?? '');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/webp');
});

test('the card maker refuses cards above five stars', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/cards/new');

  await page.getByLabel('Name', { exact: true }).fill('Overpowered');
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    await page.getByLabel(side, { exact: true }).selectOption('10');
  }

  await expect(page.getByText(/Too strong/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save card' })).toBeDisabled();
});

test('a player builds a new deck with live rule feedback', async ({ page }) => {
  await signUp(page, uniqueUsername());
  await page.goto('/decks');

  await page.getByLabel('New deck name').fill('Lizard swarm');
  await page.getByRole('button', { name: 'New deck' }).click();
  await expect(page.getByRole('heading', { name: 'Edit deck' })).toBeVisible();

  const addLizard = page.getByRole('button', { name: 'Add Sand Lizard' });
  for (let i = 0; i < 4; i++) await addLizard.click();

  await expect(page.getByText('4 / 20 cards')).toBeVisible();
  await expect(page.getByText('A deck needs exactly 20 cards (this one has 4).')).toBeVisible();
  await expect(page.getByText('At most 3 cards with the same stats (found 4).')).toBeVisible();

  await page.getByRole('button', { name: 'Remove one Sand Lizard' }).click();
  await expect(page.getByText(/same stats/)).toBeHidden();

  await page.getByRole('button', { name: 'Save deck' }).click();
  await expect(page.getByText('Deck saved.')).toBeVisible();

  await page.goto('/decks');
  const deck = page.getByRole('listitem', { name: 'Lizard swarm' });
  await expect(deck).toContainText('Cards3 / 20');
  await expect(deck.getByText('Needs fixing')).toBeVisible();
  await expect(deck.getByText('A deck needs exactly 20 cards (this one has 3).')).toBeVisible();
});
