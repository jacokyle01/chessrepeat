import { expect, test } from '@playwright/test';
import { activeMove, addChapter, addComment, chapterRow, deleteChapter, move, PGN, setMode, tipTitle } from '../support/app';
import { playMove } from '../support/board';
import { expectSignedInAs, freshUser, loginAs, waitForSocket } from '../support/auth';

// Everything a signed-in user does goes to the server (HTTP for chapters,
// WebSocket for moves, comments and training). A reload throws away all
// local state, so "still there after reload" means "the server has it".
test('a signed-in user boots from the server, not the playground seed', async ({ page, context, request }) => {
  const user = await loginAs(request, context, freshUser());
  await page.goto('/');

  await expectSignedInAs(page, user.username);
  await expect(page.locator('.panel-title', { hasText: 'Repertoire' })).toBeVisible();
  await expect(chapterRow(page, 'Example Chapter')).toHaveCount(0);
  await expect(tipTitle(page)).toHaveText('Repertoire is empty');
});

test('chapters, moves, comments and training round-trip through the server', async ({ page, context, request }) => {
  const user = await loginAs(request, context, freshUser());
  await page.goto('/');
  await expectSignedInAs(page, user.username);
  await waitForSocket(page);

  const row = await addChapter(page, { name: 'Italian', pgn: PGN.ITALIAN, trainAs: 'white', signedIn: true });
  await expect(row.locator('.chapter-size')).toHaveText('3 moves');

  // Learn first, while e4 is the only first move (the search is depth-first
  // from the last-added child, so a sideline added later would be picked).
  await setMode(page, 'learn');
  await playMove(page, 'e2', 'e4');
  await expect(row.locator('.chapter-count-unseen')).toHaveText('2');

  await setMode(page, 'edit');
  await playMove(page, 'd2', 'd4');
  await expect(move(page, 'd4')).toBeVisible();
  await expect(row.locator('.chapter-count-unseen')).toHaveText('3');
  await addComment(page, 'e4', 'king pawn');

  // Let the socket flush before we drop the page.
  await page.waitForTimeout(500);
  await page.reload();
  await expectSignedInAs(page, user.username);
  await waitForSocket(page);

  const again = chapterRow(page, 'Italian');
  await expect(again).toBeVisible();
  await again.click();
  await expect(again.locator('.chapter-size')).toHaveText('4 moves');
  await expect(again.locator('.chapter-count-unseen')).toHaveText('3');
  await setMode(page, 'edit');
  await expect(move(page, 'd4')).toBeVisible();
  await expect(page.locator('.tree-body .comment', { hasText: 'king pawn' })).toBeVisible();

  await deleteChapter(page, 'Italian');
  await page.waitForTimeout(500);
  await page.reload();
  await expectSignedInAs(page, user.username);
  await expect(chapterRow(page, 'Italian')).toHaveCount(0);
  await expect(tipTitle(page)).toHaveText('Repertoire is empty');
});

test('signing out returns to the playground', async ({ page, context, request }) => {
  const user = await loginAs(request, context, freshUser());
  await page.goto('/');
  await expectSignedInAs(page, user.username);

  await page.getByTitle('Sign out').click();
  await expect(page.locator('.header-username')).toHaveCount(0);
  await expect(chapterRow(page, 'Example Chapter')).toBeVisible();
  await expect(activeMove(page)).toHaveCount(0);
});
