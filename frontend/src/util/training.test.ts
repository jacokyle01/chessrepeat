import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { computeDueCounts, computeNextTrainableNode, merge, pgnFromChapter } from './training';
import { cardDueIn, chapter, ITALIAN, node, root } from '../test/fixtures';
import { useAuthStore } from '../store/auth';
import type { NodeSearch } from '../types/training';

const DAY = 24 * 60 * 60 * 1000;
const dfs: NodeSearch = { algorithm: 'dfs', limit: 30 };
const bfs: NodeSearch = { algorithm: 'bfs', limit: 30 };

beforeEach(() => {
  // playground: cards are keyed by PLAYGROUND_KEY (see fixtures.cardDueIn)
  useAuthStore.setState({ user: null });
  vi.useFakeTimers({ now: new Date('2026-03-01T09:00:00Z') });
});
afterEach(() => vi.useRealTimers());

describe('computeNextTrainableNode / learn', () => {
  test('finds the first enabled, unseen move from the root', () => {
    const c = chapter(ITALIAN, 'white');
    const ctx = computeNextTrainableNode(c.root, 'learn', dfs);
    expect(ctx?.startingPath).toBe('');
    expect(ctx?.targetMove.data.san).toBe('e4');
  });

  test('skips moves that already have a card and reports the path to the parent', () => {
    const c = chapter(ITALIAN, 'white');
    const e4 = c.root.children[0];
    e4.data.training = cardDueIn(DAY);
    const ctx = computeNextTrainableNode(c.root, 'learn', dfs);
    expect(ctx?.targetMove.data.san).toBe('Nf3');
    // startingPath is the path to the position the move is played *from*
    expect(ctx?.startingPath).toBe(e4.data.id + e4.children[0].data.id);
  });

  test('disabled (opponent) moves are never targets', () => {
    const c = chapter(ITALIAN, 'black');
    const ctx = computeNextTrainableNode(c.root, 'learn', dfs);
    expect(ctx?.targetMove.data.san).toBe('e5');
    expect(ctx?.startingPath).toBe(c.root.children[0].data.id);
  });

  test('returns null when every enabled move has been learned', () => {
    const c = chapter(ITALIAN, 'white');
    let cur = c.root;
    while (cur.children.length) {
      cur = cur.children[0];
      if (cur.data.enabled) cur.data.training = cardDueIn(DAY);
    }
    expect(computeNextTrainableNode(c.root, 'learn', dfs)).toBeNull();
  });

  test('dfs vs bfs pick different targets on a branching tree', () => {
    //  root -> aa (seen) -> bb (unseen, deep)
    //       -> cc (unseen, shallow)
    const r = root(node('aa', { training: cardDueIn(DAY), children: [node('bb')] }), node('cc'));
    // dfs pops from the back, so it explores the last sibling first
    expect(computeNextTrainableNode(r, 'learn', dfs)?.targetMove.data.id).toBe('cc');
    // bfs shifts from the front, exhausting layer 0 before going deeper
    expect(computeNextTrainableNode(r, 'learn', bfs)?.targetMove.data.id).toBe('cc');

    const deepFirst = root(
      node('aa', { training: cardDueIn(DAY), children: [node('bb')] }),
      node('cc', { training: cardDueIn(DAY) }),
    );
    expect(computeNextTrainableNode(deepFirst, 'learn', bfs)?.targetMove.data.id).toBe('bb');
    expect(computeNextTrainableNode(deepFirst, 'learn', dfs)?.targetMove.data.id).toBe('bb');
  });

  test('search limit caps how deep a target can be', () => {
    // a single line 6 plies deep, nothing seen
    const c = chapter(ITALIAN, 'white');
    // limit 1 => only the first full move (2 plies) is reachable
    const shallow = computeNextTrainableNode(c.root, 'learn', { algorithm: 'dfs', limit: 1 });
    expect(shallow?.targetMove.data.san).toBe('e4');
    c.root.children[0].data.training = cardDueIn(DAY);
    const blocked = computeNextTrainableNode(c.root, 'learn', { algorithm: 'dfs', limit: 1 });
    expect(blocked).toBeNull();
    const deeper = computeNextTrainableNode(c.root, 'learn', { algorithm: 'dfs', limit: 2 });
    expect(deeper?.targetMove.data.san).toBe('Nf3');
  });

  test('an empty chapter has nothing to learn', () => {
    expect(computeNextTrainableNode(root(), 'learn', dfs)).toBeNull();
  });
});

describe('computeNextTrainableNode / recall', () => {
  test('only cards that are due count', () => {
    const c = chapter(ITALIAN, 'white');
    const e4 = c.root.children[0];
    const nf3 = e4.children[0].children[0];
    e4.data.training = cardDueIn(DAY); // not yet
    nf3.data.training = cardDueIn(-1000); // overdue
    const ctx = computeNextTrainableNode(c.root, 'recall', dfs);
    expect(ctx?.targetMove.data.san).toBe('Nf3');
  });

  test('a card due exactly now is due', () => {
    const c = chapter(ITALIAN, 'white');
    c.root.children[0].data.training = cardDueIn(0);
    expect(computeNextTrainableNode(c.root, 'recall', dfs)?.targetMove.data.san).toBe('e4');
  });

  test('unseen moves are not recalled', () => {
    const c = chapter(ITALIAN, 'white');
    expect(computeNextTrainableNode(c.root, 'recall', dfs)).toBeNull();
  });

  test('a card becomes due once time passes', () => {
    const c = chapter(ITALIAN, 'white');
    c.root.children[0].data.training = cardDueIn(2 * DAY);
    expect(computeNextTrainableNode(c.root, 'recall', dfs)).toBeNull();
    vi.advanceTimersByTime(3 * DAY);
    expect(computeNextTrainableNode(c.root, 'recall', dfs)?.targetMove.data.san).toBe('e4');
  });

  test('cards belonging to another user are ignored', () => {
    const c = chapter(ITALIAN, 'white');
    c.root.children[0].data.training = cardDueIn(-1000, 'someone-else');
    expect(computeNextTrainableNode(c.root, 'recall', dfs)).toBeNull();
    useAuthStore.setState({ user: { username: 'someone-else' } });
    expect(computeNextTrainableNode(c.root, 'recall', dfs)?.targetMove.data.san).toBe('e4');
  });
});

describe('computeDueCounts', () => {
  test('buckets by seconds until due, with index 0 = due now', () => {
    const r = root(
      node('aa', { training: cardDueIn(-5000) }), // due
      node('bb', { training: cardDueIn(30 * 1000) }), // < 1 min
      node('cc', { training: cardDueIn(2 * 60 * 60 * 1000) }), // < 1 day
      node('dd', { training: cardDueIn(3 * DAY) }), // beyond every bucket
      node('ee'), // unseen: not counted
      node('ff', { enabled: false, training: cardDueIn(-5000) }), // disabled: not counted
    );
    // buckets are in ms here (the caller passes ms offsets; the name says seconds)
    const buckets = [60 * 1000, DAY];
    expect(computeDueCounts(r, buckets)).toEqual([1, 1, 1]);
  });

  test('empty tree', () => {
    expect(computeDueCounts(root(), [1000])).toEqual([0, 0]);
  });
});

describe('merge', () => {
  test('adds missing branches and recurses into shared ones', () => {
    const a = root(node('aa', { children: [node('bb')] }));
    const b = root(node('aa', { children: [node('cc')] }), node('dd'));
    merge(a, b);
    expect(a.children.map((n) => n.data.id)).toEqual(['aa', 'dd']);
    expect(a.children[0].children.map((n) => n.data.id)).toEqual(['bb', 'cc']);
  });
});

describe('pgnFromChapter', () => {
  test('emits the chapter name header and every line', () => {
    const c = chapter('1. e4 c5 (1... e5 2. Nf3) 2. Nf3 *', 'white', 'Open Sicilian');
    const pgn = pgnFromChapter(c);
    expect(pgn).toContain('[ChessrepeatChapterName "Open Sicilian"]');
    expect(pgn).toMatch(/1\. e4 c5 \( 1\.\.\. e5 2\. Nf3 \) 2\. Nf3/);
  });

  test('writes comments in braces', () => {
    const c = chapter(ITALIAN);
    c.root.children[0].data.comment = 'best by test';
    expect(pgnFromChapter(c)).toContain('e4 { best by test }');
  });
});
