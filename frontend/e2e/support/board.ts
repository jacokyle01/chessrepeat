import { expect, type Page } from '@playwright/test';
import { store } from './app';

// Chessground draws the board as one <cg-board> element and positions
// pieces by transform, so there is nothing per-square to click. Instead
// we compute the centre of a square from the board's bounding box and
// the chapter's orientation, then click-click (select, then destination),
// which chessground treats like a user move.
//
// The app re-applies the chessground config on every React render, and a
// render landing between the two clicks (a WebSocket "crowd" message, a
// due-count refresh) can drop the selection. So each click is confirmed
// against chessground's own `square.selected` marker and retried if the
// board didn't take it. Illegal or non-trainable destinations are simply
// ignored by chessground (the selection is cleared and no move happens),
// so a test that plays the wrong move sees no change — assert on the tree.
function centre(square: string, box: { x: number; y: number; width: number; height: number }, orientation: 'white' | 'black') {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  const size = box.width / 8;
  return { x: box.x + (col + 0.5) * size, y: box.y + (row + 0.5) * size };
}

export async function playMove(page: Page, from: string, to: string) {
  const board = page.locator('cg-board');
  await expect(board).toBeVisible();
  const box = await board.boundingBox();
  if (!box) throw new Error('board has no bounding box');
  const { trainAs } = await store(page);
  const a = centre(from, box, trainAs);
  const b = centre(to, box, trainAs);
  const selected = board.locator('square.selected');

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.click(a.x, a.y);
    if (await selected.isVisible().catch(() => false)) break;
    await page.waitForTimeout(150);
    if (await selected.isVisible().catch(() => false)) break;
  }
  await expect(selected, `could not select ${from}`).toBeVisible();

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(150);
    if (!(await selected.isVisible().catch(() => false))) break;
  }
  await expect(selected, `move ${from}${to} was not taken`).toBeHidden();
}
