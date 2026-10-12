# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: playground/first-run.spec.ts >> "Last move" jumps to the end of the mainline in edit mode
- Location: e2e/playground/first-run.spec.ts:53:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('.tree-body .move.active')
Expected: "Rd8#"
Received: "e5"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" locator('.tree-body .move.active') with timeout 5000ms
  - waiting for locator('.tree-body .move.active')
    14 × locator resolved to <div data-path="/?WG" class="move active">e5</div>
       - unexpected value "e5"

```

```yaml
- text: e5
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { activeMove, chapterRow, move, setMode, tipTitle } from '../support/app';
  3  | 
  4  | test('a first visit is seeded with the example chapter', async ({ page }) => {
  5  |   await page.goto('/');
  6  | 
  7  |   const row = chapterRow(page, 'Example Chapter');
  8  |   await expect(row).toBeVisible();
  9  |   await expect(row).toHaveClass(/is-selected/);
  10 |   await expect(row.locator('.chapter-side')).toHaveAttribute('title', 'Trained as white');
  11 | 
  12 |   // Nothing is being trained yet, and the seed chapter nudges the user
  13 |   // toward Learn. Outside edit mode the tree only draws the line being
  14 |   // trained, so it is empty until a mode is picked.
  15 |   await expect(tipTitle(page)).toHaveText('No training mode selected');
  16 |   await expect(page.locator('.training-btn-learn')).toHaveClass(/is-prompted/);
  17 |   await expect(page.locator('.tree-body .move')).toHaveCount(0);
  18 | 
  19 |   await setMode(page, 'edit');
  20 |   await expect(move(page, 'e4')).toBeVisible();
  21 |   await expect(move(page, 'Rd8#')).toBeVisible();
  22 |   await expect(page.locator('.tree-body .move')).toHaveCount(33);
  23 | });
  24 | 
  25 | test('the seed is written once — a reload does not add a second copy', async ({ page }) => {
  26 |   await page.goto('/');
  27 |   await expect(chapterRow(page, 'Example Chapter')).toBeVisible();
  28 | 
  29 |   await page.reload();
  30 |   await expect(chapterRow(page, 'Example Chapter')).toBeVisible();
  31 |   await expect(page.locator('.chapter-row')).toHaveCount(1);
  32 | });
  33 | 
  34 | test('clicking a move in the tree selects it', async ({ page }) => {
  35 |   await page.goto('/');
  36 |   await setMode(page, 'edit');
  37 |   await expect(move(page, 'e4')).toBeVisible();
  38 | 
  39 |   await move(page, 'Nf3').click();
  40 |   await expect(activeMove(page)).toHaveText('Nf3');
  41 | 
  42 |   await page.getByRole('button', { name: 'Previous move' }).click();
  43 |   await expect(activeMove(page)).toHaveText('e5');
  44 | 
  45 |   await page.getByRole('button', { name: 'First move' }).click();
  46 |   await expect(activeMove(page)).toHaveCount(0);
  47 | });
  48 | 
  49 | // Known bug: in edit mode "Last move" reads `activeChapter` off the store
  50 | // (src/components/pgn/TreeControls.tsx), which no longer exists, so the
  51 | // click throws and the selection stays put. Flip this to a plain test once
  52 | // it's fixed — Playwright fails the run when a test.fail() test passes.
  53 | test('"Last move" jumps to the end of the mainline in edit mode', async ({ page }) => {
  54 |   test.fail();
  55 |   await page.goto('/');
  56 |   await setMode(page, 'edit');
  57 |   await move(page, 'e5').click();
  58 |   await page.getByRole('button', { name: 'Last move' }).click();
> 59 |   await expect(activeMove(page)).toHaveText('Rd8#');
     |                                  ^ Error: expect(locator).toHaveText(expected) failed
  60 | });
  61 | 
```