import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { signUp, uniqueUsername } from './helpers';

/** Accessible names of the cards in the grid, in display order. */
function cardNames(page: Page): Promise<string[]> {
  return page
    .getByRole('main')
    .getByRole('listitem')
    .getByRole('img', { name: /, \d stars?, top / })
    .evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
}

const filterBar = (page: Page) => page.getByRole('search', { name: 'Filter cards' });

test('the trunk can be searched, filtered and sorted, and keeps filters in the URL', async ({
  page,
}) => {
  await signUp(page, uniqueUsername());
  await page.goto('/trunk');
  // The count appears once the cards have streamed in.
  await expect(filterBar(page)).toContainText(/\d+ cards$/);
  const total = (await cardNames(page)).length;
  expect(total).toBeGreaterThan(5);

  await filterBar(page).getByLabel('Search').fill('wyrm');
  await expect(page).toHaveURL(/\/trunk\?q=wyrm$/);
  await expect.poll(() => cardNames(page)).toEqual([expect.stringMatching(/^Sky Wyrm,/)]);
  await expect(filterBar(page)).toContainText(`Showing 1 of ${String(total)} cards`);

  // A reload keeps the filter.
  await page.reload();
  await expect(filterBar(page).getByLabel('Search')).toHaveValue('wyrm');
  await expect.poll(async () => (await cardNames(page)).length).toBe(1);

  await filterBar(page).getByRole('button', { name: 'Clear filters' }).click();
  await expect(page).toHaveURL(/\/trunk$/);
  await expect.poll(async () => (await cardNames(page)).length).toBe(total);

  await filterBar(page).getByLabel('Stars').selectOption('1');
  await filterBar(page).getByLabel('Element').selectOption('none');
  await expect(page).toHaveURL(/stars=1&element=none$/);
  const plainOneStars = await cardNames(page);
  expect(plainOneStars.length).toBeGreaterThan(0);
  for (const name of plainOneStars) expect(name).toMatch(/, 1 star, .*, no element$/);

  await filterBar(page).getByLabel('Sort').selectOption('name');
  await expect(page).toHaveURL(/sort=name$/);
  const sorted = await cardNames(page);
  expect(sorted).toEqual([...sorted].sort((a, b) => a.localeCompare(b)));

  await filterBar(page).getByLabel('Search').fill('no such card');
  await expect(page.getByText('No cards match these filters.')).toBeVisible();
});

test('players can filter their own cards, and the trunk tells them apart', async ({ page }) => {
  await signUp(page, uniqueUsername());
  const art = await sharp({
    create: {
      width: 600,
      height: 840,
      channels: 4,
      background: { r: 40, g: 160, b: 90, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  for (const [name, element] of [
    ['Cactuar', ''],
    ['Tonberry', 'water'],
  ] as const) {
    await page.goto('/cards/new');
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Element', { exact: true }).selectOption(element);
    await page
      .getByLabel('Art')
      .setInputFiles({ name: 'art.png', mimeType: 'image/png', buffer: art });
    await page.getByRole('button', { name: 'Save card' }).click();
    await expect(page).toHaveURL('/cards');
  }

  // Card maker: only the player's cards, so no source filter.
  await expect(filterBar(page).getByLabel('Source')).toHaveCount(0);
  await filterBar(page).getByLabel('Element').selectOption('water');
  await expect.poll(() => cardNames(page)).toEqual([expect.stringMatching(/^Tonberry,/)]);

  // Trunk: starter cards and the player's own, told apart by the source filter.
  await page.goto('/trunk?source=made&sort=name');
  await expect(filterBar(page).getByLabel('Source')).toHaveValue('made');
  await expect
    .poll(() => cardNames(page))
    .toEqual([expect.stringMatching(/^Cactuar,/), expect.stringMatching(/^Tonberry,/)]);
});
