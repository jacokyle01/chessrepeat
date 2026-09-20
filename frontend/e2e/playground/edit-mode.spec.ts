import { expect, test } from '@playwright/test';
import { activeMove, addChapter, addComment, chapterRow, move, moveMenu, PGN, setMode } from '../support/app';
import { playMove } from '../support/board';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await addChapter(page, { name: 'Italian', pgn: PGN.ITALIAN, trainAs: 'white' });
  await setMode(page, 'edit');
});

test('playing a new move on the board adds a sideline', async ({ page }) => {
  await playMove(page, 'd2', 'd4');

  const d4 = move(page, 'd4');
  await expect(d4).toBeVisible();
  await expect(d4).toHaveClass(/variation/);
  await expect(activeMove(page)).toHaveText(/d4/);
  await expect(chapterRow(page, 'Italian').locator('.chapter-size')).toHaveText('4 moves');

  // The move is a real position: black can reply to it.
  await playMove(page, 'g8', 'f6');
  await expect(move(page, 'Nf6')).toBeVisible();
  await expect(chapterRow(page, 'Italian').locator('.chapter-size')).toHaveText('4 moves');
});

test('playing a move that already exists just follows it', async ({ page }) => {
  await playMove(page, 'e2', 'e4');
  await expect(activeMove(page)).toHaveText('e4');
  await expect(move(page, 'e4')).toHaveCount(1);
  await expect(chapterRow(page, 'Italian').locator('.chapter-size')).toHaveText('3 moves');
});

test('delete from here removes the line', async ({ page }) => {
  await playMove(page, 'd2', 'd4');
  await expect(move(page, 'd4')).toBeVisible();

  await moveMenu(page, 'd4', 'Delete from here');

  await expect(move(page, 'd4')).toHaveCount(0);
  await expect(chapterRow(page, 'Italian').locator('.chapter-size')).toHaveText('3 moves');
  await expect(activeMove(page)).toHaveCount(0);
});

test('comments can be added, are shown in the tree, and persist', async ({ page }) => {
  await addComment(page, 'e4', 'king pawn');

  // The mode is not persisted, so a reload lands back in "no mode" with an
  // empty tree; re-enter edit to see the whole chapter.
  await page.reload();
  await chapterRow(page, 'Italian').click();
  await setMode(page, 'edit');
  await expect(page.locator('.tree-body .comment', { hasText: 'king pawn' })).toBeVisible();

  await page.getByRole('button', { name: 'Hide comments' }).click();
  await expect(page.locator('.tree-body .comment')).toHaveCount(0);
});

test('edits persist across a reload', async ({ page }) => {
  await playMove(page, 'd2', 'd4');
  await expect(move(page, 'd4')).toBeVisible();

  await page.reload();
  await chapterRow(page, 'Italian').click();
  await setMode(page, 'edit');
  await expect(move(page, 'd4')).toBeVisible();
});
