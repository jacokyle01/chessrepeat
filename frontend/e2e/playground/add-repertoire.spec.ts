import { expect, test } from '@playwright/test';
import { addChapter, chapterRow, move, PGN, setMode, store } from '../support/app';

test('adding a chapter from PGN shows it in the sidebar and the tree', async ({ page }) => {
  await page.goto('/');
  await expect(chapterRow(page, 'Example Chapter')).toBeVisible();

  const row = await addChapter(page, { name: 'Slav', pgn: PGN.SLAV, trainAs: 'white' });

  // Only white's moves are trained in a white chapter.
  await expect(row.locator('.chapter-size')).toHaveText('2 moves');
  await expect(row.locator('.chapter-count-unseen')).toHaveText('2');
  await setMode(page, 'edit');
  await expect(move(page, 'd4')).toBeVisible();
  await expect(move(page, 'c6')).toBeVisible();
  expect(await store(page)).toMatchObject({ chapterName: 'Slav', trainAs: 'white' });
});

test('a black chapter flips the board and trains black moves', async ({ page }) => {
  await page.goto('/');
  const row = await addChapter(page, { name: 'French', pgn: PGN.FRENCH, trainAs: 'black' });

  await expect(row.locator('.chapter-side')).toHaveAttribute('title', 'Trained as black');
  await expect(row.locator('.chapter-size')).toHaveText('1 move');
  await expect(page.locator('.cg-wrap')).toHaveClass(/orientation-black/);
});

test('the form needs a colour before it will submit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add to repertoire' }).click();
  const dialog = page.locator('.add-rep-dialog');
  await dialog.locator('#name').fill('Nothing');
  await dialog.locator('.add-rep-pgn-input').fill(PGN.SLAV);
  await expect(dialog.locator('.add-rep-submit')).toBeDisabled();
  await dialog.locator('.add-rep-color', { hasText: 'White' }).click();
  await expect(dialog.locator('.add-rep-submit')).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();
  await expect(chapterRow(page, 'Nothing')).toHaveCount(0);
});

test('chapters survive a reload (IndexedDB), white before black', async ({ page }) => {
  await page.goto('/');
  await addChapter(page, { name: 'French', pgn: PGN.FRENCH, trainAs: 'black' });
  await addChapter(page, { name: 'Slav', pgn: PGN.SLAV, trainAs: 'white' });

  await page.reload();

  await expect(chapterRow(page, 'Slav')).toBeVisible();
  await expect(chapterRow(page, 'French')).toBeVisible();
  await expect(chapterRow(page, 'Example Chapter')).toBeVisible();
  const names = await page.locator('.chapter-row .chapter-name').allTextContents();
  expect(names.indexOf('French')).toBe(names.length - 1);
});
