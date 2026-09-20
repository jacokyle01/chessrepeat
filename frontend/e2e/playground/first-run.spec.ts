import { expect, test } from '@playwright/test';
import { activeMove, chapterRow, move, setMode, tipTitle } from '../support/app';

test('a first visit is seeded with the example chapter', async ({ page }) => {
  await page.goto('/');

  const row = chapterRow(page, 'Example Chapter');
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/is-selected/);
  await expect(row.locator('.chapter-side')).toHaveAttribute('title', 'Trained as white');

  // Nothing is being trained yet, and the seed chapter nudges the user
  // toward Learn. Outside edit mode the tree only draws the line being
  // trained, so it is empty until a mode is picked.
  await expect(tipTitle(page)).toHaveText('No training mode selected');
  await expect(page.locator('.training-btn-learn')).toHaveClass(/is-prompted/);
  await expect(page.locator('.tree-body .move')).toHaveCount(0);

  await setMode(page, 'edit');
  await expect(move(page, 'e4')).toBeVisible();
  await expect(move(page, 'Rd8#')).toBeVisible();
  await expect(page.locator('.tree-body .move')).toHaveCount(33);
});

test('the seed is written once — a reload does not add a second copy', async ({ page }) => {
  await page.goto('/');
  await expect(chapterRow(page, 'Example Chapter')).toBeVisible();

  await page.reload();
  await expect(chapterRow(page, 'Example Chapter')).toBeVisible();
  await expect(page.locator('.chapter-row')).toHaveCount(1);
});

test('clicking a move in the tree selects it', async ({ page }) => {
  await page.goto('/');
  await setMode(page, 'edit');
  await expect(move(page, 'e4')).toBeVisible();

  await move(page, 'Nf3').click();
  await expect(activeMove(page)).toHaveText('Nf3');

  await page.getByRole('button', { name: 'Previous move' }).click();
  await expect(activeMove(page)).toHaveText('e5');

  await page.getByRole('button', { name: 'First move' }).click();
  await expect(activeMove(page)).toHaveCount(0);
});

// Known bug: in edit mode "Last move" reads `activeChapter` off the store
// (src/components/pgn/TreeControls.tsx), which no longer exists, so the
// click throws and the selection stays put. Flip this to a plain test once
// it's fixed — Playwright fails the run when a test.fail() test passes.
test('"Last move" jumps to the end of the mainline in edit mode', async ({ page }) => {
  test.fail();
  await page.goto('/');
  await setMode(page, 'edit');
  await move(page, 'e5').click();
  await page.getByRole('button', { name: 'Last move' }).click();
  await expect(activeMove(page)).toHaveText('Rd8#');
});
