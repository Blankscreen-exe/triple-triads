import { expect, test, type Browser, type Page } from '@playwright/test';
import { signUp, uniqueUsername } from './helpers';

async function newPlayer(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signUp(page, uniqueUsername());
  return page;
}

async function createRoom(
  page: Page,
  name: string,
  { color, timer }: { color: 'Red' | 'Blue'; timer: '30' | 'null' },
) {
  await page.goto('/play');
  await page.getByLabel('Room name').fill(name);
  await page.getByRole('group', { name: 'Your colour' }).getByText(color, { exact: true }).click();
  await page.getByLabel('Turn timer').selectOption(timer);
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByText('Waiting for an opponent…')).toBeVisible();
}

const filters = (page: Page) => page.getByRole('search', { name: 'Filter rooms' });

function roomNames(page: Page): Promise<string[]> {
  // Direct children only: each row also contains a list of rule chips.
  return page
    .getByRole('list', { name: 'Open rooms' })
    .locator(':scope > li')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
}

test('the lobby can be searched and filtered, and the filters stay in the URL', async ({
  browser,
}) => {
  // Other tests' rooms may still be open, so every check is scoped by this unique tag.
  const tag = uniqueUsername();
  const alpha = `${tag} Alpha`;
  const bravo = `${tag} Bravo`;
  await createRoom(await newPlayer(browser), alpha, { color: 'Red', timer: '30' });
  await createRoom(await newPlayer(browser), bravo, { color: 'Blue', timer: 'null' });

  const viewer = await newPlayer(browser);
  await viewer.goto('/play');
  await filters(viewer).getByLabel('Search').fill(tag);
  await expect.poll(() => roomNames(viewer)).toEqual([bravo, alpha]); // newest first
  await expect(viewer).toHaveURL(new RegExp(`/play\\?q=${tag}$`));

  // Joining Bravo makes you red (its host is blue).
  await filters(viewer).getByLabel('Your colour').selectOption('red');
  await expect.poll(() => roomNames(viewer)).toEqual([bravo]);
  await filters(viewer).getByLabel('Your colour').selectOption('');

  await filters(viewer).getByLabel('Timer').selectOption('30');
  await expect.poll(() => roomNames(viewer)).toEqual([alpha]);
  await expect(filters(viewer)).toContainText('Showing 1 of');

  // The filters survive a reload.
  await viewer.reload();
  await expect(filters(viewer).getByLabel('Timer')).toHaveValue('30');
  await expect.poll(() => roomNames(viewer)).toEqual([alpha]);

  await filters(viewer).getByLabel('Timer').selectOption('');
  const openHands = filters(viewer).getByRole('button', { name: 'Open hands' });
  await openHands.click();
  await expect(openHands).toHaveAttribute('aria-pressed', 'true');
  // Neither room uses Open hands.
  await expect(viewer.getByText('No rooms match these filters.')).toBeVisible();

  await filters(viewer).getByRole('button', { name: 'Clear filters' }).click();
  await expect(viewer).toHaveURL(/\/play$/);
  await expect(openHands).toHaveAttribute('aria-pressed', 'false');
});
