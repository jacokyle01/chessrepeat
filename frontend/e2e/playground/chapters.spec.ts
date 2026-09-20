import { expect, test } from '@playwright/test';
import { addChapter, chapterRow, deleteChapter, PGN, renameChapter, tipTitle } from '../support/app';

test('rename a chapter', async ({ page }) => {
  await page.goto('/');
  await renameChapter(page, 'Example Chapter', 'Scotch Gambit');

  await expect(chapterRow(page, 'Example Chapter')).toHaveCount(0);
  // The Learn nudge is keyed off the seed name, so it goes away.
  await expect(page.locator('.training-btn-learn')).not.toHaveClass(/is-prompted/);

  await page.reload();
  await expect(chapterRow(page, 'Scotch Gambit')).toBeVisible();
});

test('delete a chapter', async ({ page }) => {
  await page.goto('/');
  await addChapter(page, { name: 'Slav', pgn: PGN.SLAV, trainAs: 'white' });

  await deleteChapter(page, 'Example Chapter');
  await expect(page.locator('.chapter-row')).toHaveCount(1);

  await page.reload();
  await expect(chapterRow(page, 'Slav')).toBeVisible();
  await expect(chapterRow(page, 'Example Chapter')).toHaveCount(0);
});

test('deleting the selected chapter clears the board', async ({ page }) => {
  await page.goto('/');
  await deleteChapter(page, 'Example Chapter');
  await expect(tipTitle(page)).toHaveText('Repertoire is empty');
});
