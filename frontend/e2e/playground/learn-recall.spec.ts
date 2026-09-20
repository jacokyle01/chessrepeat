import { expect, test } from '@playwright/test';
import { activeMove, addChapter, chapterRow, PGN, setMode, tipAction, tipTitle } from '../support/app';
import { playMove } from '../support/board';

// A two-move white chapter: learn e4 then Nf3, then recall both.
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await addChapter(page, { name: 'Mini', pgn: PGN.MINI, trainAs: 'white' });
});

test('learn walks through every unseen move', async ({ page }) => {
  const row = chapterRow(page, 'Mini');
  await expect(row.locator('.chapter-count-unseen')).toHaveText('2');

  await setMode(page, 'learn');
  await expect(tipTitle(page)).toHaveText('Play the move');
  // The move to learn is drawn on the board.
  await expect(page.locator('.cg-shapes')).toBeVisible();

  await playMove(page, 'e2', 'e4');
  await expect(row.locator('.chapter-count-unseen')).toHaveText('1');
  await expect(activeMove(page)).toHaveText('e5');
  await expect(tipTitle(page)).toHaveText('Play the move');

  // Wrong square: learn only accepts the target, so nothing happens.
  await playMove(page, 'd2', 'd4');
  await expect(activeMove(page)).toHaveText('e5');

  await playMove(page, 'g1', 'f3');
  await expect(tipTitle(page)).toHaveText('No more moves to learn');
  await expect(row.locator('.chapter-count-unseen')).toHaveCount(0);
});

test('recall: a wrong guess can be undone, right guesses advance the schedule', async ({ page }) => {
  const row = chapterRow(page, 'Mini');
  await setMode(page, 'learn');
  await playMove(page, 'e2', 'e4');
  await playMove(page, 'g1', 'f3');
  await expect(tipTitle(page)).toHaveText('No more moves to learn');

  // Freshly learned cards are due straight away.
  await setMode(page, 'recall');
  await expect(tipTitle(page)).toHaveText('Play the move');
  await expect(row.locator('.chapter-count-due')).toHaveText('2');

  await playMove(page, 'd2', 'd4');
  await expect(tipTitle(page)).toHaveText('d4 is incorrect');
  await expect(tipAction(page, 'CONTINUE')).toBeVisible();
  await tipAction(page, 'UNDO').click();
  await expect(tipTitle(page)).toHaveText('Play the move');

  await playMove(page, 'e2', 'e4');
  await expect(activeMove(page)).toHaveText('e5');
  await expect(row.locator('.chapter-count-due')).toHaveText('1');

  await playMove(page, 'g1', 'f3');
  await expect(tipTitle(page)).toHaveText('No more moves to recall');
  await expect(row.locator('.chapter-count-due')).toHaveCount(0);

  // The schedule is persisted: nothing is due again after a reload.
  await page.reload();
  await row.click();
  await setMode(page, 'recall');
  await expect(tipTitle(page)).toHaveText('No more moves to recall');
});

test('a failed recall marked CONTINUE reschedules the move rather than dropping it', async ({ page }) => {
  const row = chapterRow(page, 'Mini');
  await setMode(page, 'learn');
  await playMove(page, 'e2', 'e4');
  await playMove(page, 'g1', 'f3');

  await setMode(page, 'recall');
  await playMove(page, 'd2', 'd4');
  await expect(tipTitle(page)).toHaveText('d4 is incorrect');
  await tipAction(page, 'CONTINUE').click();

  // e4 is rated Again. With short-term scheduling off that pushes it a day
  // out, so only Nf3 is still due and training moves on to it. (The due
  // badge isn't recounted by CONTINUE itself, so it's checked after the
  // next move rather than here.)
  await expect(activeMove(page)).toHaveText('e5');
  await playMove(page, 'g1', 'f3');
  await expect(tipTitle(page)).toHaveText('No more moves to recall');
  await expect(row.locator('.chapter-count-due')).toHaveCount(0);
  // ...but it is still a learned move, not back in the unseen pile.
  await expect(row.locator('.chapter-count-unseen')).toHaveCount(0);
});
