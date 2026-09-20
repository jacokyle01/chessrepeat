import { expect, type Locator, type Page } from '@playwright/test';

// Locators and flows for the parts of the UI the user paths go through.
// Kept to what a user can see or click; anything that needs store state
// goes through `store()` and is deliberately rare.

export const PGN = {
  ITALIAN: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *',
  SLAV: '1. d4 d5 2. c4 c6 *',
  FRENCH: '1. e4 e6 *',
  MINI: '1. e4 e5 2. Nf3 *',
};

export function chapterRow(page: Page, name: string): Locator {
  return page.locator('.chapter-row').filter({ has: page.locator('.chapter-name', { hasText: name }) });
}

// A move cell in the tree, matched on its SAN exactly (sideline moves carry
// their move number inline, e.g. "1.d4").
export function move(page: Page, san: string): Locator {
  const escaped = san.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.locator('.tree-body .move').filter({ hasText: new RegExp(`^(\\d+\\.+\\s*)?${escaped}$`) });
}

export const activeMove = (page: Page) => page.locator('.tree-body .move.active');
// The "nothing left" tip uses a muted title class; treat both as the title.
export const tipTitle = (page: Page) => page.locator('.tip-title, .tip-title-muted');
export const tipAction = (page: Page, label: string) => page.locator('.tip-action', { hasText: label });

export async function setMode(page: Page, mode: 'edit' | 'learn' | 'recall') {
  await page.locator(`.training-btn-${mode}`).click();
  await expect(page.locator(`.training-btn-${mode}`)).toHaveClass(/is-active/);
}

// `signedIn`: the server answers POST /chapter by broadcasting a reload to
// the room, and the client resyncs by refetching /repertoire. While that is
// in flight the selection is cleared, and a board move landing in that
// window is dropped. Signed-in tests wait for the refetch and for the root
// to be reselected before carrying on.
export async function addChapter(
  page: Page,
  opts: { name: string; pgn: string; trainAs: 'white' | 'black'; select?: boolean; signedIn?: boolean },
) {
  await page.getByRole('button', { name: 'Add to repertoire' }).click();
  const dialog = page.locator('.add-rep-dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#name').fill(opts.name);
  await dialog.locator('.add-rep-pgn-input').fill(opts.pgn);
  // The radio itself is visually hidden behind the styled label.
  await dialog.locator('.add-rep-color', { hasText: opts.trainAs === 'white' ? 'White' : 'Black' }).click();
  const resync = opts.signedIn
    ? page.waitForResponse((r) => r.url().includes('/repertoire') && r.request().method() === 'GET')
    : Promise.resolve();
  await dialog.locator('.add-rep-submit').click();
  await expect(dialog).toBeHidden();
  await resync;
  const row = chapterRow(page, opts.name);
  await expect(row).toBeVisible();
  if (opts.select ?? true) {
    await row.click();
    await expect(row).toHaveClass(/is-selected/);
  }
  await expect.poll(() => store(page).then((s) => s.chapterName)).toBe(opts.name);
  return row;
}

export async function openChapterMenu(page: Page, name: string) {
  const row = chapterRow(page, name);
  await row.getByRole('button', { name: 'Chapter options' }).click();
  return page.locator('.chapter-actions');
}

export async function renameChapter(page: Page, from: string, to: string) {
  const actions = await openChapterMenu(page, from);
  await actions.getByRole('button', { name: 'Rename' }).click();
  await actions.getByLabel('Chapter name').fill(to);
  await actions.getByRole('button', { name: 'Save name' }).click();
  await expect(chapterRow(page, to)).toBeVisible();
}

export async function deleteChapter(page: Page, name: string) {
  const actions = await openChapterMenu(page, name);
  await actions.getByRole('button', { name: 'Delete' }).click();
  await expect(actions).toContainText('Delete this chapter?');
  await actions.locator('.chapter-action-confirm-yes').click();
  await expect(chapterRow(page, name)).toHaveCount(0);
}

// Right-click a move and pick one of its context-menu entries.
export async function moveMenu(page: Page, san: string, item: string) {
  await move(page, san).click({ button: 'right' });
  await page.locator('.ctxmenu-item', { hasText: item }).click();
}

export async function addComment(page: Page, san: string, text: string) {
  await moveMenu(page, san, 'Add comment');
  const editor = page.locator('.comment-editor');
  await editor.locator('textarea').fill(text);
  await editor.locator('.comment-editor-save').click();
  await expect(page.locator('.tree-body .comment', { hasText: text })).toBeVisible();
}

// Snapshot of the bits of store state a test occasionally needs. Exposed
// on window by src/main.tsx when Vite runs with VITE_E2E=1.
export async function store(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).__chessrepeat.trainer.getState();
    const chapter = s.repertoire.find((c: any) => c.uuid === s.selectedChapterId);
    return {
      trainingMethod: s.trainingMethod as string | null,
      selectedPath: s.selectedPath as string,
      selectedSan: (s.selectedNode?.data?.san ?? '') as string,
      chapterName: (chapter?.name ?? null) as string | null,
      trainAs: (chapter?.trainAs ?? 'white') as 'white' | 'black',
      repertoireAuthor: s.repertoireAuthor as string | null,
    };
  });
}
