import { expect, test } from '@playwright/test';
import { addChapter, chapterRow, move, PGN, setMode, store } from '../support/app';
import { playMove } from '../support/board';
import { expectSignedInAs, freshUser, loginAs, waitForSocket } from '../support/auth';

// Two browsers, two users: the owner shares their repertoire, the
// collaborator opens it, and a move played by the owner shows up in the
// collaborator's tree without a reload — the WebSocket fan-out path.
test('an edit collaborator sees the owner moves live', async ({ browser, request }) => {
  const ownerCtx = await browser.newContext();
  const owner = await loginAs(request, ownerCtx, freshUser('own'));
  const ownerPage = await ownerCtx.newPage();

  // A second API context so the two logins don't share a cookie jar.
  const collabCtx = await browser.newContext();
  const collabRequest = await collabCtx.request;
  const collab = await loginAs(collabRequest, collabCtx, freshUser('col'));
  const collabPage = await collabCtx.newPage();

  await ownerPage.goto('/');
  await expectSignedInAs(ownerPage, owner.username);
  await waitForSocket(ownerPage);
  await addChapter(ownerPage, { name: 'Shared', pgn: PGN.MINI, trainAs: 'white', signedIn: true });

  await ownerPage.getByRole('button', { name: 'Share repertoire' }).click();
  await ownerPage.getByPlaceholder('username').fill(collab.username);
  await ownerPage.locator('.collab-add-btn').click();
  await expect(ownerPage.locator('.collab-name', { hasText: collab.username })).toBeVisible();
  await ownerPage.locator('.modal-close-x').click();

  await collabPage.goto('/');
  await expectSignedInAs(collabPage, collab.username);
  await collabPage.getByRole('button', { name: 'Share repertoire' }).click();
  await collabPage.locator('.collab-open-btn', { hasText: owner.username }).click();

  await expect(collabPage.locator('#repertoire .panel-title')).toHaveText(`${owner.username}'s repertoire`);
  await expect(chapterRow(collabPage, 'Shared')).toBeVisible();
  expect((await store(collabPage)).repertoireAuthor).toBe(owner.username);
  await waitForSocket(collabPage);
  await chapterRow(collabPage, 'Shared').click();
  await setMode(collabPage, 'edit');
  await expect(move(collabPage, 'Nf3')).toBeVisible();

  await setMode(ownerPage, 'edit');
  await playMove(ownerPage, 'd2', 'd4');
  await expect(move(ownerPage, 'd4')).toBeVisible();

  await expect(move(collabPage, 'd4')).toBeVisible({ timeout: 10_000 });

  await ownerCtx.close();
  await collabCtx.close();
});
